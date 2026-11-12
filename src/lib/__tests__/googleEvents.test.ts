import { eventId, planSync, toEvent } from '../googleEvents';
import { instanceOf } from '../schedule';
import type { Shift } from '@/store/types';

const shift: Shift = {
  id: 'rot1@2026-11-11', workplaceId: 'w', date: '2026-11-11', start: '22:00', end: '06:00',
  breakMin: 0, color: 'plum', title: 'Night', tz: 'America/New_York',
};

describe('google event ids', () => {
  it('are valid base32hex, 5+ chars and stable', () => {
    const id = eventId(shift.id);
    expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
    expect(eventId(shift.id)).toBe(id);
    expect(eventId('rot1@2026-11-12')).not.toBe(id);
  });
});

describe('planSync', () => {
  const from = Date.parse('2026-11-01T00:00:00Z');
  const to = Date.parse('2026-12-01T00:00:00Z');
  const ev = toEvent(instanceOf(shift), 'City Hospital');

  it('writes the overnight end on the next day', () => {
    expect(ev.end.dateTime).toBe('2026-11-12T11:00:00.000Z');
    expect(ev.location).toBe('City Hospital');
  });

  it('inserts new, updates changed, skips unchanged, removes stale inside the window only', () => {
    const changed = toEvent(instanceOf({ ...shift, id: 's2', title: 'Night (cover)' }));
    const plan = planSync([ev, changed], [
      { id: changed.id, extendedProperties: { private: { shiftly: 'old' } } },
      { id: 'shstale', start: { dateTime: '2026-11-20T10:00:00Z' } },
      { id: 'shhistory', start: { dateTime: '2026-09-01T10:00:00Z' } },
    ], from, to);
    expect(plan.insert.map((e) => e.id)).toEqual([ev.id]);
    expect(plan.update.map((e) => e.id)).toEqual([changed.id]);
    expect(plan.remove).toEqual(['shstale']);

    const again = planSync([ev], [{ id: ev.id, extendedProperties: ev.extendedProperties }], from, to);
    expect(again).toEqual({ insert: [], update: [], remove: [] });
  });
});
