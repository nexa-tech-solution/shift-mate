import type { ClockSession, ID, Rotation, Shift, ShiftInstance, ShiftTemplate, YMD } from '@/store/types';
import { formatDate, formatTime } from './format';
import { expandRotation, nextOrCurrent } from './schedule';
import { hmOf, MIN, ymdOf } from './time';

/** The shift a clock-in belongs to: one in progress, or starting within the hour. */
export const clockTarget = (instances: ShiftInstance[], now: number) =>
  instances.find((i) => i.endsAt > now && i.startsAt - now <= 60 * MIN);

/**
 * The shift record a finished clock session produces: the clocked times logged as `actual`
 * on its scheduled shift, or on `fresh` (a new shift) when there was none.
 * Returns null when the session is too short to log.
 */
export function finishClock(
  data: { shifts: Shift[]; rotations: Rotation[] },
  templates: Record<string, ShiftTemplate>,
  clock: ClockSession,
  endedAt: number,
  fresh: Shift,
): { shift: Shift; detach?: { rotationId: ID; date: YMD } } | null {
  const start = hmOf(new Date(clock.startedAt));
  const end = hmOf(new Date(endedAt));
  // shortcut: sessions are stored as wall-clock HH:mm, so under a minute can't be logged and past 24h wraps; store instants if long sessions matter.
  if (endedAt - clock.startedAt < MIN || start === end) return null;
  const log = (s: Shift): Shift => ({ ...s, actual: { start, end, breakMin: s.breakMin } });

  const [rotationId, date] = clock.shiftId?.includes('@') ? clock.shiftId.split('@') : [];
  const rotation = data.rotations.find((r) => r.id === rotationId);
  const occ = rotation && date ? expandRotation(rotation, templates, date, date)[0] : undefined;
  // logging a rotation day turns it into a standalone shift, same as editing it
  if (rotation && occ) return { shift: log({ ...occ, id: fresh.id }), detach: { rotationId: rotation.id, date: occ.date } };

  const stored = data.shifts.find((s) => s.id === clock.shiftId);
  return { shift: log(stored ?? { ...fresh, date: ymdOf(new Date(clock.startedAt)), start, end, breakMin: 0 }) };
}

/** 1:05:09 */
export function formatElapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${Math.floor(s / 3600)}:${two(Math.floor(s / 60) % 60)}:${two(s % 60)}`;
}

/** What the Home Screen widget shows. `startedAt` is 0 when not clocked in. */
export interface ClockWidgetProps {
  label: string;
  big: string;
  sub: string;
  startedAt: number;
}

export function widgetProps(clock: ClockSession | null, instances: ShiftInstance[], at: number, fmt: '12h' | '24h'): ClockWidgetProps {
  if (clock) {
    const title = instances.find((i) => i.id === clock.shiftId)?.title ?? 'Unscheduled';
    return { label: 'Clocked in', big: formatTime(hmOf(new Date(clock.startedAt)), fmt), sub: title, startedAt: clock.startedAt };
  }
  const next = nextOrCurrent(instances, at);
  if (!next) return { label: 'Next shift', big: 'None', sub: 'Nothing scheduled', startedAt: 0 };
  if (next.startsAt <= at) return { label: 'On shift now', big: formatTime(next.end, fmt), sub: `${next.title} ends`, startedAt: 0 };
  const day = next.date === ymdOf(new Date(at)) ? 'Today' : formatDate(next.date, { weekday: 'short', month: 'short', day: 'numeric' });
  return { label: 'Next shift', big: formatTime(next.start, fmt), sub: `${day} · ${next.title}`, startedAt: 0 };
}
