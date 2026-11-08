import { expandRotation, getInstances, instanceOf, nextOrCurrent, overlaps, paidMinutes, toWorked } from '../schedule';
import { addDays, diffDays, startOfWeek, toInstant, weekday } from '../time';
import type { Rotation, Shift, ShiftTemplate } from '@/store/types';

const NY = 'America/New_York';
const base: Shift = {
  id: 's1', workplaceId: 'w', date: '2026-03-10', start: '09:00', end: '17:00',
  breakMin: 30, color: 'sun', title: 'Day', tz: NY,
};

describe('date helpers', () => {
  it('adds days across month/year ends and leap days', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(diffDays('2027-01-01', '2026-12-25')).toBe(7);
  });
  it('computes weekdays and week starts', () => {
    expect(weekday('2026-11-08')).toBe(0); // Sunday
    expect(startOfWeek('2026-11-11', 1)).toBe('2026-11-09');
    expect(startOfWeek('2026-11-11', 0)).toBe('2026-11-08');
    expect(startOfWeek('2026-11-08', 1)).toBe('2026-11-02');
  });
});

describe('shift intervals', () => {
  it('deducts unpaid breaks', () => {
    expect(paidMinutes(instanceOf(base))).toBe(450);
  });

  it('rolls overnight shifts into the next day', () => {
    const i = instanceOf({ ...base, start: '22:00', end: '06:00', breakMin: 0 });
    expect(paidMinutes(i)).toBe(480);
    expect(i.endsAt).toBe(toInstant('2026-03-11', '06:00', NY));
  });

  it('treats equal start and end as a 24h shift', () => {
    expect(paidMinutes(instanceOf({ ...base, start: '08:00', end: '08:00', breakMin: 0 }))).toBe(1440);
  });

  it('uses real elapsed time across DST changes', () => {
    // US spring forward: 2026-03-08 02:00 → 03:00
    const spring = instanceOf({ ...base, date: '2026-03-07', start: '22:00', end: '06:00', breakMin: 0 });
    expect(paidMinutes(spring)).toBe(420);
    // Fall back: 2026-11-01 02:00 → 01:00
    const fall = instanceOf({ ...base, date: '2026-10-31', start: '22:00', end: '06:00', breakMin: 0 });
    expect(paidMinutes(fall)).toBe(540);
  });

  it('never goes negative when the break exceeds the shift', () => {
    expect(paidMinutes(instanceOf({ ...base, start: '09:00', end: '09:20', breakMin: 30 }))).toBe(0);
  });

  it('respects the shift time zone', () => {
    const berlin = instanceOf({ ...base, tz: 'Europe/Berlin', start: '09:00', end: '10:00' });
    expect(new Date(berlin.startsAt).toISOString()).toBe('2026-03-10T08:00:00.000Z');
  });
});

describe('rotations', () => {
  const templates: Record<string, ShiftTemplate> = {
    d: { id: 'd', workplaceId: 'w', name: 'Day', start: '07:00', end: '19:00', breakMin: 60, color: 'sun' },
    n: { id: 'n', workplaceId: 'w', name: 'Night', start: '19:00', end: '07:00', breakMin: 60, color: 'plum' },
  };
  const rot: Rotation = {
    id: 'r', workplaceId: 'w', name: '2-2-3', startDate: '2026-11-02', tz: NY,
    pattern: ['d', 'd', null, null, 'n', 'n', null], exceptions: ['2026-11-07'],
  };

  it('cycles the pattern and skips days off and exceptions', () => {
    const got = expandRotation(rot, templates, '2026-11-01', '2026-11-16').map((i) => `${i.date}:${i.templateId}`);
    expect(got).toEqual([
      '2026-11-02:d', '2026-11-03:d', '2026-11-06:n', // 11-07 excepted
      '2026-11-09:d', '2026-11-10:d', '2026-11-13:n', '2026-11-14:n',
      '2026-11-16:d',
    ]);
  });

  it('stops at the end date and ignores missing templates', () => {
    const got = expandRotation({ ...rot, endDate: '2026-11-03', pattern: ['d', 'x'] }, templates, '2026-11-01', '2026-11-30');
    expect(got.map((i) => i.date)).toEqual(['2026-11-02']);
  });

  it('merges manual and generated shifts sorted by start', () => {
    const manual: Shift = { ...base, id: 'm', date: '2026-11-02', start: '05:00', end: '06:00', tz: NY };
    const all = getInstances([manual], [rot], templates, '2026-11-02', '2026-11-02');
    expect(all.map((i) => i.id)).toEqual(['m', 'r@2026-11-02']);
    expect(overlaps(all[0], all)).toHaveLength(0);
  });
});

describe('worked vs scheduled', () => {
  const i = instanceOf(base);
  it('counts nothing for unfinished, unlogged shifts', () => {
    expect(toWorked(i, i.startsAt + 1000)).toBeNull();
  });
  it('falls back to the schedule once ended', () => {
    expect(toWorked(i, i.endsAt)).toBe(i);
  });
  it('prefers logged actual times', () => {
    const w = toWorked({ ...i, actual: { start: '09:15', end: '18:00', breakMin: 30 } }, 0)!;
    expect(paidMinutes(w)).toBe(495);
  });
  it('finds the current or next shift', () => {
    const later = instanceOf({ ...base, id: 's2', date: '2026-03-11' });
    expect(nextOrCurrent([i, later], i.startsAt + 1)?.id).toBe('s1');
    expect(nextOrCurrent([i, later], i.endsAt)?.id).toBe('s2');
  });
});
