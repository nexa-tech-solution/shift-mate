import type { Rotation, Shift, ShiftInstance, ShiftTemplate, YMD } from '@/store/types';
import { addDays, diffDays, eachDay, interval, MIN } from './time';

export const instanceOf = (s: Shift, rotationId?: string): ShiftInstance => {
  const { startsAt, endsAt } = interval(s.date, s.start, s.end, s.tz);
  return { ...s, rotationId, startsAt, endsAt };
};

export const rotationOccurrenceId = (rotationId: string, date: YMD) => `${rotationId}@${date}`;

/** Template index for a date in the rotation cycle, or null when the date is outside / a day off. */
export function rotationTemplateFor(rot: Rotation, date: YMD): string | null {
  if (date < rot.startDate || (rot.endDate && date > rot.endDate) || !rot.pattern.length) return null;
  if (rot.exceptions.includes(date)) return null;
  const n = rot.pattern.length;
  return rot.pattern[((diffDays(date, rot.startDate) % n) + n) % n];
}

export function expandRotation(
  rot: Rotation,
  templates: Record<string, ShiftTemplate>,
  from: YMD,
  to: YMD,
): ShiftInstance[] {
  const out: ShiftInstance[] = [];
  for (const date of eachDay(from < rot.startDate ? rot.startDate : from, to)) {
    const tid = rotationTemplateFor(rot, date);
    const t = tid ? templates[tid] : undefined;
    if (!t) continue;
    out.push(
      instanceOf(
        {
          id: rotationOccurrenceId(rot.id, date),
          workplaceId: rot.workplaceId,
          date,
          start: t.start,
          end: t.end,
          breakMin: t.breakMin,
          color: t.color,
          title: t.name,
          tz: rot.tz,
          templateId: t.id,
        },
        rot.id,
      ),
    );
  }
  return out;
}

/** All shifts whose start date falls in [from, to], sorted by start time. */
export function getInstances(
  shifts: Shift[],
  rotations: Rotation[],
  templates: Record<string, ShiftTemplate>,
  from: YMD,
  to: YMD,
): ShiftInstance[] {
  const manual = shifts.filter((s) => s.date >= from && s.date <= to).map((s) => instanceOf(s));
  const generated = rotations.flatMap((r) => expandRotation(r, templates, from, to));
  return [...manual, ...generated].sort((a, b) => a.startsAt - b.startsAt);
}

export const grossMinutes = (i: Pick<ShiftInstance, 'startsAt' | 'endsAt'>) =>
  Math.max(0, Math.round((i.endsAt - i.startsAt) / MIN));

export const paidMinutes = (i: ShiftInstance) => Math.max(0, grossMinutes(i) - i.breakMin);

/**
 * The shift as actually worked: logged actual times, or the schedule once it has ended.
 * Returns null for shifts not yet finished with nothing logged.
 */
export function toWorked(i: ShiftInstance, now: number): ShiftInstance | null {
  if (i.actual) {
    // shortcut: actual start is assumed on the scheduled date; a clock-in before midnight of the prior day isn't modelled.
    const { startsAt, endsAt } = interval(i.date, i.actual.start, i.actual.end, i.tz);
    return { ...i, start: i.actual.start, end: i.actual.end, breakMin: i.actual.breakMin, startsAt, endsAt };
  }
  return i.endsAt <= now ? i : null;
}

/** Current shift (in progress) or the next upcoming one. */
export function nextOrCurrent(instances: ShiftInstance[], now: number) {
  return instances.find((i) => i.endsAt > now) ?? null;
}

/** Instances overlapping another (same day collisions) — used to warn in the editor. */
export function overlaps(candidate: Pick<ShiftInstance, 'id' | 'startsAt' | 'endsAt'>, others: ShiftInstance[]) {
  return others.filter((o) => o.id !== candidate.id && o.startsAt < candidate.endsAt && candidate.startsAt < o.endsAt);
}

export const neighbourRange = (date: YMD) => ({ from: addDays(date, -1), to: addDays(date, 1) });
