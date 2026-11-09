/** Calendar date in the shift's own wall-clock, 'YYYY-MM-DD'. */
export type YMD = string;
/** Wall-clock time, 'HH:mm' (24h). */
export type HM = string;
export type ID = string;

export const SHIFT_COLORS = ['sun', 'ember', 'rose', 'plum', 'ocean', 'mint', 'slate'] as const;
export type ShiftColor = (typeof SHIFT_COLORS)[number];

export type PayPeriodConfig =
  | { kind: 'weekly'; anchor: YMD }
  | { kind: 'biweekly'; anchor: YMD }
  | { kind: 'semimonthly' }
  | { kind: 'monthly'; startDay: number }; // 1–28

/** Premium. All optional, user-configured; nothing here encodes any jurisdiction's law. */
export interface PayRules {
  dailyOvertime?: { afterHours: number; multiplier: number };
  weeklyOvertime?: { afterHours: number; multiplier: number };
  night?: { start: HM; end: HM; extraPerHour: number };
  weekendMultiplier?: number;
}

export interface Workplace {
  id: ID;
  name: string;
  color: ShiftColor;
  hourlyRate: number;
  payPeriod: PayPeriodConfig;
  rules: PayRules;
}

export interface ShiftTemplate {
  id: ID;
  workplaceId: ID;
  name: string;
  start: HM;
  end: HM;
  breakMin: number;
  color: ShiftColor;
}

export interface Shift {
  id: ID;
  workplaceId: ID;
  date: YMD;
  start: HM;
  end: HM; // end <= start means it ends the next day
  breakMin: number; // unpaid
  color: ShiftColor;
  title: string;
  tz: string; // IANA zone the wall-clock times belong to
  note?: string;
  templateId?: ID;
  rateOverride?: number;
  /** Logged actual times; when absent a past shift counts as worked as scheduled. */
  actual?: { start: HM; end: HM; breakMin: number };
}

export interface Rotation {
  id: ID;
  workplaceId: ID;
  name: string;
  startDate: YMD;
  endDate?: YMD;
  /** One entry per day of the cycle: template id or null (day off). */
  pattern: (ID | null)[];
  tz: string;
  /** Dates removed from the rotation (deleted, or detached into a standalone Shift). */
  exceptions: YMD[];
}

export interface Paycheck {
  workplaceId: ID;
  periodStart: YMD;
  amount: number;
}

export interface Settings {
  currency: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: 0 | 1;
  theme: 'system' | 'light' | 'dark';
  reminders: { enabled: boolean; leadMinutes: number };
  haptics: boolean;
  onboarded: boolean;
  /** Device calendar (e.g. a Google account's) that shifts are copied into, and the events Shiftly created there. */
  calendarSync?: { calendarId: string; title: string; eventIds: string[] };
}

/** A concrete shift on the calendar — either a stored Shift or a generated rotation occurrence. */
export interface ShiftInstance extends Shift {
  rotationId?: ID;
  startsAt: number; // epoch ms
  endsAt: number;
}
