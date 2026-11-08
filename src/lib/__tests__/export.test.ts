import { buildCsv, buildReportHtml } from '../export';
import type { DataState } from '@/store/useStore';

jest.mock('expo-file-system', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-print', () => ({}));
jest.mock('expo-sqlite/kv-store', () => ({}));

const state: DataState = {
  settings: { currency: 'USD', timeFormat: '12h', weekStartsOn: 1, theme: 'system', reminders: { enabled: false, leadMinutes: 60 }, haptics: true, onboarded: true },
  workplaces: [{ id: 'w', name: 'Diner, Main St', color: 'sun', hourlyRate: 20, payPeriod: { kind: 'semimonthly' }, rules: {} }],
  templates: [],
  rotations: [],
  paychecks: [],
  shifts: [
    { id: 'b', workplaceId: 'w', date: '2026-11-04', start: '09:00', end: '13:00', breakMin: 0, color: 'sun', title: 'Late', tz: 'UTC' },
    { id: 'a', workplaceId: 'w', date: '2026-11-03', start: '09:00', end: '17:30', breakMin: 30, color: 'sun', title: 'Open', tz: 'UTC', note: '=HYPERLINK("x") "quoted"' },
  ],
};

it('builds sorted, escaped CSV with worked hours only for finished shifts', () => {
  const now = Date.UTC(2026, 10, 4, 10); // during shift b
  const lines = buildCsv(state, '2026-11-01', '2026-11-30', false, now).split('\n');
  expect(lines[0]).toMatch(/^Date,Workplace/);
  expect(lines[1]).toBe(`2026-11-03,"Diner, Main St",Open,09:00,17:30,30,8.00,8.00,160.00,USD,"'=HYPERLINK(""x"") ""quoted"""`);
  expect(lines[2]).toBe('2026-11-04,"Diner, Main St",Late,09:00,13:00,0,4.00,,80.00,USD,');
});

it('builds an escaped PDF report with totals', () => {
  const html = buildReportHtml({ ...state, shifts: [{ ...state.shifts[0], title: '<b>x</b>' }] }, '2026-11-01', '2026-11-30', false, Date.UTC(2026, 10, 5));
  expect(html).not.toContain('<b>x</b>');
  expect(html).toContain('&#60;b&#62;x');
  expect(html).toContain('4.00h');
});
