import type { PayPeriodConfig, ShiftInstance, Workplace, YMD } from '@/store/types';
import { grossMinutes, paidMinutes } from './schedule';
import { addDays, DAY_MIN, daysInMonth, diffDays, hmToMin, pad, startOfWeek, weekday } from './time';

export interface Period {
  start: YMD;
  end: YMD; // inclusive
}

export function periodFor(date: YMD, cfg: PayPeriodConfig): Period {
  const y = +date.slice(0, 4);
  const m = +date.slice(5, 7);
  const d = +date.slice(8, 10);
  switch (cfg.kind) {
    case 'weekly':
    case 'biweekly': {
      const len = cfg.kind === 'weekly' ? 7 : 14;
      const offset = ((diffDays(date, cfg.anchor) % len) + len) % len;
      const start = addDays(date, -offset);
      return { start, end: addDays(start, len - 1) };
    }
    case 'semimonthly':
      return d <= 15
        ? { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-15` }
        : { start: `${y}-${pad(m)}-16`, end: `${y}-${pad(m)}-${pad(daysInMonth(y, m))}` };
    case 'monthly': {
      const sd = Math.min(Math.max(1, Math.round(cfg.startDay)), 28);
      const startMonth = d >= sd ? new Date(Date.UTC(y, m - 1, sd)) : new Date(Date.UTC(y, m - 2, sd));
      const start = startMonth.toISOString().slice(0, 10);
      const next = new Date(Date.UTC(startMonth.getUTCFullYear(), startMonth.getUTCMonth() + 1, sd));
      return { start, end: addDays(next.toISOString().slice(0, 10), -1) };
    }
  }
}

export const shiftPeriod = (p: Period, cfg: PayPeriodConfig, delta: -1 | 1) =>
  periodFor(delta < 0 ? addDays(p.start, -1) : addDays(p.end, 1), cfg);

export interface Breakdown {
  paidMin: number;
  regularMin: number;
  dailyOtMin: number;
  weeklyOtMin: number;
  nightMin: number;
  weekendMin: number;
  pay: number;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Wall-clock minutes of the shift that fall inside the nightly window / on Sat–Sun. */
function wallSegments(i: ShiftInstance, night?: { start: string; end: string }) {
  const s = hmToMin(i.start);
  const len = grossMinutes(i);
  const e = s + len;
  let nightMin = 0;
  if (night) {
    const ns = hmToMin(night.start);
    let ne = hmToMin(night.end);
    if (ne <= ns) ne += DAY_MIN;
    for (let k = -1; k <= 2; k++) nightMin += overlap(s, e, k * DAY_MIN + ns, k * DAY_MIN + ne);
  }
  let weekendMin = 0;
  for (let k = 0; k <= 2; k++) {
    const wd = weekday(addDays(i.date, k));
    if (wd === 0 || wd === 6) weekendMin += overlap(s, e, k * DAY_MIN, (k + 1) * DAY_MIN);
  }
  return { nightMin: Math.min(nightMin, len), weekendMin: Math.min(weekendMin, len), len };
}

/**
 * Estimated gross pay per shift for one workplace.
 * Advanced rules (premium) are user-configured; multipliers don't stack — the highest of
 * overtime vs weekend applies, the night premium is an additive per-hour amount.
 * Breaks are deducted proportionally across segments.
 * Pass enough history (e.g. the whole week before a period) for weekly overtime to be right.
 */
export function computeEarnings(
  instances: ShiftInstance[],
  wp: Workplace,
  opts: { weekStartsOn: 0 | 1; advanced: boolean },
): Map<string, Breakdown> {
  const out = new Map<string, Breakdown>();
  const r = wp.rules;
  const dayTotals = new Map<YMD, number>();
  const weekTotals = new Map<YMD, number>();
  const sorted = instances.filter((i) => i.workplaceId === wp.id).sort((a, b) => a.startsAt - b.startsAt);

  for (const i of sorted) {
    const rate = i.rateOverride ?? wp.hourlyRate;
    const paid = paidMinutes(i);
    if (!opts.advanced) {
      out.set(i.id, { paidMin: paid, regularMin: paid, dailyOtMin: 0, weeklyOtMin: 0, nightMin: 0, weekendMin: 0, pay: (paid / 60) * rate });
      continue;
    }
    let dailyOt = 0;
    if (r.dailyOvertime) {
      const before = dayTotals.get(i.date) ?? 0;
      const after = r.dailyOvertime.afterHours * 60;
      dailyOt = Math.max(0, before + paid - after) - Math.max(0, before - after);
      dayTotals.set(i.date, before + paid);
    }
    let weeklyOt = 0;
    const counted = paid - dailyOt; // daily overtime isn't counted again toward the weekly threshold
    if (r.weeklyOvertime) {
      const wk = startOfWeek(i.date, opts.weekStartsOn);
      const before = weekTotals.get(wk) ?? 0;
      const after = r.weeklyOvertime.afterHours * 60;
      weeklyOt = Math.max(0, before + counted - after) - Math.max(0, before - after);
      weekTotals.set(wk, before + counted);
    }
    const seg = wallSegments(i, r.night);
    const scale = seg.len ? paid / seg.len : 0;
    const nightMin = seg.nightMin * scale;
    const weekendMin = seg.weekendMin * scale;
    const f = paid ? weekendMin / paid : 0;
    const wm = r.weekendMultiplier ?? 1;
    const eff = (mult: number) => f * Math.max(mult, wm) + (1 - f) * mult;
    const regular = paid - dailyOt - weeklyOt;
    const units =
      regular * eff(1) +
      dailyOt * eff(r.dailyOvertime?.multiplier ?? 1) +
      weeklyOt * eff(r.weeklyOvertime?.multiplier ?? 1);
    const pay = (units / 60) * rate + (nightMin / 60) * (r.night?.extraPerHour ?? 0);
    out.set(i.id, { paidMin: paid, regularMin: regular, dailyOtMin: dailyOt, weeklyOtMin: weeklyOt, nightMin, weekendMin, pay });
  }
  return out;
}

export interface PeriodSummary {
  shifts: number;
  paidMin: number;
  otMin: number;
  nightMin: number;
  pay: number;
}

export function summarize(ids: string[], b: Map<string, Breakdown>): PeriodSummary {
  const s: PeriodSummary = { shifts: 0, paidMin: 0, otMin: 0, nightMin: 0, pay: 0 };
  for (const id of ids) {
    const x = b.get(id);
    if (!x) continue;
    s.shifts++;
    s.paidMin += x.paidMin;
    s.otMin += x.dailyOtMin + x.weeklyOtMin;
    s.nightMin += x.nightMin;
    s.pay += x.pay;
  }
  return s;
}

export const hasAdvancedRules = (r: Workplace['rules']) =>
  !!(r.dailyOvertime || r.weeklyOvertime || r.night || (r.weekendMultiplier && r.weekendMultiplier !== 1));
