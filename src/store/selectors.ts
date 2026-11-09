import { useEffect, useMemo, useState } from 'react';
import { computeEarnings, periodFor, summarize, type Period } from '@/lib/pay';
import { PAYWALL_ENABLED, usePremium } from '@/lib/purchases';
import { getInstances, toWorked } from '@/lib/schedule';
import { addDays } from '@/lib/time';
import type { ShiftInstance, Workplace, YMD } from './types';
import { useStore } from './useStore';

export function useTemplateMap() {
  const templates = useStore((s) => s.templates);
  return useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates]);
}

export function useInstances(from: YMD, to: YMD) {
  const shifts = useStore((s) => s.shifts);
  const rotations = useStore((s) => s.rotations);
  const tm = useTemplateMap();
  return useMemo(() => getInstances(shifts, rotations, tm, from, to), [shifts, rotations, tm, from, to]);
}

/** Re-renders every `ms` so countdowns stay live. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export const useIsPremium = () => usePremium((s) => s.isPremium || !PAYWALL_ENABLED);

/** Workplaces visible to the user — free tier only uses the first one. */
export function useActiveWorkplaces(): Workplace[] {
  const all = useStore((s) => s.workplaces);
  const premium = useIsPremium();
  return useMemo(() => (premium ? all : all.slice(0, 1)), [all, premium]);
}

export interface PeriodData {
  period: Period;
  instances: ShiftInstance[];
  scheduled: ReturnType<typeof summarize>;
  worked: ReturnType<typeof summarize>;
  /** Pay for each instance: worked figure where available, else scheduled. */
  perShift: Map<string, { pay: number; paidMin: number; worked: boolean }>;
}

/** Scheduled vs worked earnings for one workplace's pay period. */
export function usePeriodData(wp: Workplace | undefined, anchorDate: YMD, now: number): PeriodData | null {
  const shifts = useStore((s) => s.shifts);
  const rotations = useStore((s) => s.rotations);
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const tm = useTemplateMap();
  const advanced = useIsPremium();
  // `now` rounded to the minute keeps memo churn low
  const minute = Math.floor(now / 60_000);
  return useMemo(() => {
    if (!wp) return null;
    const period = periodFor(anchorDate, wp.payPeriod);
    // a week of history so weekly overtime that started in the previous period is counted
    const all = getInstances(shifts, rotations, tm, addDays(period.start, -7), period.end).filter((i) => i.workplaceId === wp.id);
    const opts = { weekStartsOn, advanced };
    const sched = computeEarnings(all, wp, opts);
    const workedList = all.map((i) => toWorked(i, minute * 60_000)).filter((i): i is ShiftInstance => !!i);
    const worked = computeEarnings(workedList, wp, opts);
    const instances = all.filter((i) => i.date >= period.start);
    const ids = instances.map((i) => i.id);
    const perShift = new Map(
      instances.map((i) => {
        const w = worked.get(i.id);
        const s = sched.get(i.id)!;
        return [i.id, { pay: (w ?? s).pay, paidMin: (w ?? s).paidMin, worked: !!w }];
      }),
    );
    return { period, instances, scheduled: summarize(ids, sched), worked: summarize(ids, worked), perShift };
  }, [wp, anchorDate, shifts, rotations, tm, weekStartsOn, advanced, minute]);
}
