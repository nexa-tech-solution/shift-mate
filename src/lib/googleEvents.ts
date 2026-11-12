import type { ShiftInstance } from '@/store/types';
import { crc32 } from './xlsx';

/** Google Calendar event as Shiftly writes it. */
export interface GEvent {
  id: string;
  summary: string;
  location?: string;
  description: string;
  start: { dateTime: string };
  end: { dateTime: string };
  extendedProperties: { private: { shiftly: string } };
}

/** What a list call returns for events already in the Shiftly calendar. */
export interface GExisting {
  id: string;
  start?: { dateTime?: string };
  extendedProperties?: { private?: { shiftly?: string } };
}

const enc = new TextEncoder();

/** Stable per shift, so edits update the same event. Hex is a subset of the base32hex ids Google accepts. */
export const eventId = (instanceId: string) =>
  'sh' + Array.from(enc.encode(instanceId), (b) => b.toString(16).padStart(2, '0')).join('');

export function toEvent(i: ShiftInstance, workplace?: string): GEvent {
  const body = {
    summary: i.title,
    location: workplace,
    description: [i.note, 'Added by Shiftly'].filter(Boolean).join('\n\n'),
    start: { dateTime: new Date(i.startsAt).toISOString() },
    end: { dateTime: new Date(i.endsAt).toISOString() },
  };
  // fingerprint of what we wrote: unchanged shifts cost no request
  const hash = crc32(enc.encode(JSON.stringify(body))).toString(16);
  return { id: eventId(i.id), ...body, extendedProperties: { private: { shiftly: hash } } };
}

/**
 * Diff the events we want against what the calendar holds.
 * Only events starting in [fromMs, toMs) are candidates for removal, so history outside the window is kept.
 */
export function planSync(desired: GEvent[], existing: GExisting[], fromMs: number, toMs: number) {
  const have = new Map(existing.map((e) => [e.id, e]));
  const want = new Set(desired.map((e) => e.id));
  const insert = desired.filter((e) => !have.has(e.id));
  const update = desired.filter((e) => have.has(e.id) && have.get(e.id)!.extendedProperties?.private?.shiftly !== e.extendedProperties.private.shiftly);
  const remove = existing
    .filter((e) => !want.has(e.id))
    .filter((e) => {
      const t = e.start?.dateTime ? Date.parse(e.start.dateTime) : NaN;
      return t >= fromMs && t < toMs;
    })
    .map((e) => e.id);
  return { insert, update, remove };
}
