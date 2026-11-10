import { clockTarget, finishClock, formatElapsed, widgetProps } from '../clock';
import { instanceOf } from '../schedule';
import type { Rotation, Shift, ShiftTemplate } from '@/store/types';

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const shift = (p: Partial<Shift> = {}): Shift => ({ id: 's1', workplaceId: 'w', date: '2026-03-10', start: '09:00', end: '17:00', breakMin: 30, color: 'ember', title: 'Day', tz, ...p });
const at = (hm: string, date = '2026-03-10') => new Date(`${date}T${hm}:00`).getTime();
const fresh = shift({ id: 'new', title: 'Shift', breakMin: 0 });

describe('clockTarget', () => {
  const inst = [instanceOf(shift())];
  it('picks a shift in progress or starting within the hour', () => {
    expect(clockTarget(inst, at('08:30'))?.id).toBe('s1');
    expect(clockTarget(inst, at('12:00'))?.id).toBe('s1');
  });
  it('ignores shifts that are far off or over', () => {
    expect(clockTarget(inst, at('07:00'))).toBeUndefined();
    expect(clockTarget(inst, at('17:30'))).toBeUndefined();
  });
});

describe('finishClock', () => {
  it('logs actual times on the scheduled shift, keeping its unpaid break', () => {
    const out = finishClock({ shifts: [shift()], rotations: [] }, {}, { startedAt: at('08:55'), shiftId: 's1' }, at('17:10'), fresh);
    expect(out?.shift).toMatchObject({ id: 's1', start: '09:00', actual: { start: '08:55', end: '17:10', breakMin: 30 } });
    expect(out?.detach).toBeUndefined();
  });
  it('creates a new shift when nothing was scheduled', () => {
    const out = finishClock({ shifts: [], rotations: [] }, {}, { startedAt: at('10:00') }, at('12:30'), fresh);
    expect(out?.shift).toMatchObject({ id: 'new', date: '2026-03-10', start: '10:00', end: '12:30', actual: { start: '10:00', end: '12:30', breakMin: 0 } });
  });
  it('falls back to a new shift when the scheduled one was deleted meanwhile', () => {
    expect(finishClock({ shifts: [], rotations: [] }, {}, { startedAt: at('10:00'), shiftId: 'gone' }, at('11:00'), fresh)?.shift.id).toBe('new');
  });
  it('detaches a rotation day into a standalone logged shift', () => {
    const tpl: ShiftTemplate = { id: 't', workplaceId: 'w', name: 'Early', start: '06:00', end: '14:00', breakMin: 15, color: 'mint' };
    const rot: Rotation = { id: 'r', workplaceId: 'w', name: 'R', startDate: '2026-03-01', pattern: ['t'], tz, exceptions: [] };
    const out = finishClock({ shifts: [], rotations: [rot] }, { t: tpl }, { startedAt: at('06:02'), shiftId: 'r@2026-03-10' }, at('14:01'), fresh);
    expect(out?.detach).toEqual({ rotationId: 'r', date: '2026-03-10' });
    expect(out?.shift).toMatchObject({ id: 'new', title: 'Early', date: '2026-03-10', actual: { start: '06:02', end: '14:01', breakMin: 15 } });
  });
  it('logs nothing for a session under a minute', () => {
    expect(finishClock({ shifts: [shift()], rotations: [] }, {}, { startedAt: at('09:00'), shiftId: 's1' }, at('09:00') + 40_000, fresh)).toBeNull();
  });
});

describe('widgetProps', () => {
  const inst = [instanceOf(shift())];
  it('shows the clock-in time while clocked in', () => {
    expect(widgetProps({ startedAt: at('08:55'), shiftId: 's1' }, inst, at('10:00'), '24h')).toEqual({ label: 'Clocked in', big: '08:55', sub: 'Day', startedAt: at('08:55') });
  });
  it('shows the next shift, then its end once it is running', () => {
    expect(widgetProps(null, inst, at('07:00'), '24h')).toMatchObject({ label: 'Next shift', big: '09:00', sub: 'Today · Day', startedAt: 0 });
    expect(widgetProps(null, inst, at('10:00'), '12h')).toMatchObject({ label: 'On shift now', big: '5:00 PM' });
  });
  it('handles an empty schedule', () => {
    expect(widgetProps(null, inst, at('18:00'), '24h')).toMatchObject({ big: 'None', startedAt: 0 });
  });
});

it('formatElapsed', () => {
  expect(formatElapsed(0)).toBe('0:00:00');
  expect(formatElapsed(3_909_000)).toBe('1:05:09');
});
