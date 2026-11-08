import { computeEarnings, periodFor, shiftPeriod, summarize } from '../pay';
import { instanceOf } from '../schedule';
import type { Shift, Workplace } from '@/store/types';

const wp: Workplace = {
  id: 'w', name: 'Cafe', color: 'sun', hourlyRate: 20,
  payPeriod: { kind: 'weekly', anchor: '2026-11-02' }, rules: {},
};
const mk = (id: string, date: string, start: string, end: string, breakMin = 0, extra: Partial<Shift> = {}) =>
  instanceOf({ id, workplaceId: 'w', date, start, end, breakMin, color: 'sun', title: '', tz: 'UTC', ...extra });

describe('pay periods', () => {
  it('weekly and biweekly from an anchor, both directions', () => {
    expect(periodFor('2026-11-08', { kind: 'weekly', anchor: '2026-11-02' })).toEqual({ start: '2026-11-02', end: '2026-11-08' });
    expect(periodFor('2026-10-30', { kind: 'biweekly', anchor: '2026-11-02' })).toEqual({ start: '2026-10-19', end: '2026-11-01' });
    expect(periodFor('2026-11-20', { kind: 'biweekly', anchor: '2026-11-02' })).toEqual({ start: '2026-11-16', end: '2026-11-29' });
  });
  it('semimonthly splits on the 15th incl. February', () => {
    expect(periodFor('2026-02-20', { kind: 'semimonthly' })).toEqual({ start: '2026-02-16', end: '2026-02-28' });
    expect(periodFor('2026-02-15', { kind: 'semimonthly' })).toEqual({ start: '2026-02-01', end: '2026-02-15' });
  });
  it('monthly with a custom start day across the year end', () => {
    expect(periodFor('2026-01-10', { kind: 'monthly', startDay: 25 })).toEqual({ start: '2025-12-25', end: '2026-01-24' });
    expect(periodFor('2026-01-25', { kind: 'monthly', startDay: 25 })).toEqual({ start: '2026-01-25', end: '2026-02-24' });
  });
  it('steps to adjacent periods', () => {
    const cfg = { kind: 'semimonthly' } as const;
    expect(shiftPeriod(periodFor('2026-03-05', cfg), cfg, -1)).toEqual({ start: '2026-02-16', end: '2026-02-28' });
    expect(shiftPeriod(periodFor('2026-03-05', cfg), cfg, 1)).toEqual({ start: '2026-03-16', end: '2026-03-31' });
  });
});

describe('earnings', () => {
  it('simple estimate is paid hours × rate, honoring overrides', () => {
    const b = computeEarnings([mk('a', '2026-11-03', '09:00', '17:30', 30), mk('b', '2026-11-04', '09:00', '13:00', 0, { rateOverride: 25 })], wp, { weekStartsOn: 1, advanced: false });
    expect(b.get('a')!.pay).toBeCloseTo(160);
    expect(b.get('b')!.pay).toBeCloseTo(100);
  });

  it('ignores advanced rules unless enabled', () => {
    const rules = { dailyOvertime: { afterHours: 8, multiplier: 1.5 } };
    const b = computeEarnings([mk('a', '2026-11-03', '08:00', '20:00')], { ...wp, rules }, { weekStartsOn: 1, advanced: false });
    expect(b.get('a')!.pay).toBeCloseTo(240);
  });

  it('daily overtime spans multiple shifts on the same day', () => {
    const rules = { dailyOvertime: { afterHours: 8, multiplier: 1.5 } };
    const b = computeEarnings([mk('a', '2026-11-03', '06:00', '12:00'), mk('b', '2026-11-03', '14:00', '18:00')], { ...wp, rules }, { weekStartsOn: 1, advanced: true });
    expect(b.get('a')!.dailyOtMin).toBe(0);
    expect(b.get('b')!.dailyOtMin).toBe(120);
    expect(b.get('b')!.pay).toBeCloseTo(2 * 20 + 2 * 30);
  });

  it('weekly overtime does not double count daily overtime', () => {
    const rules = { dailyOvertime: { afterHours: 10, multiplier: 1.5 }, weeklyOvertime: { afterHours: 40, multiplier: 1.5 } };
    const days = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
    const shifts = days.map((d, k) => mk(`s${k}`, d, '06:00', '18:00')); // 12h each → 2h daily OT, 10h counted
    const b = computeEarnings([...shifts, mk('x', '2026-11-06', '08:00', '12:00')], { ...wp, rules }, { weekStartsOn: 1, advanced: true });
    expect(b.get('s3')!.dailyOtMin).toBe(120);
    expect(b.get('s3')!.weeklyOtMin).toBe(0); // 40h counted reached exactly
    expect(b.get('x')!.weeklyOtMin).toBe(240);
    const s = summarize([...b.keys()], b);
    expect(s.otMin).toBe(4 * 120 + 240);
  });

  it('weekly overtime resets at the configured week start', () => {
    const rules = { weeklyOvertime: { afterHours: 8, multiplier: 2 } };
    const b = computeEarnings([mk('sun', '2026-11-08', '08:00', '16:00'), mk('mon', '2026-11-09', '08:00', '12:00')], { ...wp, rules }, { weekStartsOn: 1, advanced: true });
    expect(b.get('mon')!.weeklyOtMin).toBe(0);
  });

  it('night premium covers the overlap of an overnight shift, with proportional breaks', () => {
    const rules = { night: { start: '22:00', end: '06:00', extraPerHour: 2 } };
    const b = computeEarnings([mk('n', '2026-11-03', '20:00', '04:00', 60)], { ...wp, rules }, { weekStartsOn: 1, advanced: true });
    const n = b.get('n')!;
    expect(n.nightMin).toBeCloseTo(360 * (420 / 480));
    expect(n.pay).toBeCloseTo(7 * 20 + (n.nightMin / 60) * 2);
  });

  it('weekend multiplier applies to Saturday/Sunday minutes; highest multiplier wins', () => {
    const rules = { weekendMultiplier: 1.25, dailyOvertime: { afterHours: 4, multiplier: 1.5 } };
    // Friday 20:00 → Saturday 04:00: 4h weekend, last 4h are OT
    const b = computeEarnings([mk('f', '2026-11-06', '20:00', '04:00')], { ...wp, rules }, { weekStartsOn: 1, advanced: true });
    const f = b.get('f')!;
    expect(f.weekendMin).toBe(240);
    // regular 4h: half weekend → 4*(0.5*1.25+0.5*1)=4.5 units; OT 4h: max(1.5,1.25)=1.5 → 6 units
    expect(f.pay).toBeCloseTo((4.5 + 6) * 20);
  });
});
