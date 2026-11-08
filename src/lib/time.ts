import { fromZonedTime } from 'date-fns-tz';
import type { HM, YMD } from '@/store/types';

export const MIN = 60_000;
export const DAY_MIN = 1440;

export const pad = (n: number) => String(n).padStart(2, '0');

export function hmToMin(hm: HM): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

export function minToHM(min: number): HM {
  const m = ((Math.round(min) % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// YMD math runs on UTC midnights so it is immune to the device's DST changes.
const ymdToUTC = (ymd: YMD) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const utcToYmd = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

export const addDays = (ymd: YMD, n: number): YMD => utcToYmd(ymdToUTC(ymd) + n * 86_400_000);
export const diffDays = (a: YMD, b: YMD) => Math.round((ymdToUTC(a) - ymdToUTC(b)) / 86_400_000);
/** 0 = Sunday … 6 = Saturday */
export const weekday = (ymd: YMD) => new Date(ymdToUTC(ymd)).getUTCDay();
export const daysInMonth = (y: number, m1: number) => new Date(Date.UTC(y, m1, 0)).getUTCDate();

export function startOfWeek(ymd: YMD, weekStartsOn: 0 | 1): YMD {
  return addDays(ymd, -((weekday(ymd) - weekStartsOn + 7) % 7));
}

export function eachDay(from: YMD, to: YMD): YMD[] {
  const out: YMD[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Local calendar date of a Date on the device. */
export const ymdOf = (d: Date): YMD => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayYmd = () => ymdOf(new Date());
export const hmOf = (d: Date): HM => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Epoch ms of a wall-clock date+time in an IANA zone (DST-aware). */
export function toInstant(ymd: YMD, hm: HM, tz: string): number {
  return fromZonedTime(`${ymd}T${hm}:00`, tz).getTime();
}

export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

/** Interval of a wall-clock shift; end <= start rolls to the next day. */
export function interval(date: YMD, start: HM, end: HM, tz: string) {
  const overnight = hmToMin(end) <= hmToMin(start);
  return {
    startsAt: toInstant(date, start, tz),
    endsAt: toInstant(overnight ? addDays(date, 1) : date, end, tz),
    overnight,
  };
}
