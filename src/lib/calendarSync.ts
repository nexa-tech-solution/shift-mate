import * as Cal from 'expo-calendar';
import type { DataState } from '@/store/useStore';
import { useStore } from '@/store/useStore';
import { getInstances } from './schedule';
import { addDays, todayYmd } from './time';

/**
 * Shifts are copied into a calendar on the device. A Google account added to the phone
 * (iOS Settings › Calendar › Accounts, or any Android phone signed in to Google) syncs that
 * calendar to Google Calendar, so no Google sign-in or API keys live in the app.
 */
export async function writableCalendars() {
  const { granted } = await Cal.requestCalendarPermissions();
  if (!granted) throw new Error('Allow ShiftMate to access your calendars in Settings, then try again.');
  const all = await Cal.getCalendars(Cal.EntityTypes.EVENT);
  return all.filter((c) => c.allowsModifications).sort((a, b) => a.source.name.localeCompare(b.source.name) || a.title.localeCompare(b.title));
}

const removeEvents = (ids: string[]) =>
  Promise.all(ids.map((id) => Cal.ExpoCalendarEvent.get(id).then((e) => e.delete()).catch(() => {})));

async function run() {
  const cs = useStore.getState().settings.calendarSync;
  if (!cs || !(await Cal.getCalendarPermissions()).granted) return;
  const st: DataState = useStore.getState();
  const cal = await Cal.ExpoCalendar.get(cs.calendarId);
  // shortcut: every sync rewrites the window (last 30 days to 4 months ahead); diff events by shift if this gets slow
  await removeEvents(cs.eventIds);
  const templates = Object.fromEntries(st.templates.map((t) => [t.id, t]));
  const wp = new Map(st.workplaces.map((w) => [w.id, w.name]));
  const ids: string[] = [];
  for (const i of getInstances(st.shifts, st.rotations, templates, addDays(todayYmd(), -30), addDays(todayYmd(), 120))) {
    const e = await cal.createEvent({
      title: i.title,
      startDate: new Date(i.startsAt),
      endDate: new Date(i.endsAt),
      location: wp.get(i.workplaceId),
      notes: [i.note, 'Added by ShiftMate'].filter(Boolean).join('\n\n'),
    });
    ids.push(e.id);
  }
  // disconnected or switched calendars while this ran: don't resurrect the old link
  const now = useStore.getState().settings.calendarSync;
  if (now?.calendarId !== cs.calendarId) return removeEvents(ids);
  useStore.getState().updateSettings({ calendarSync: { ...now, eventIds: ids } });
}

let chain: Promise<unknown> = Promise.resolve();
/** Serialised so overlapping edits never leave duplicate events. */
export const syncCalendar = () => (chain = chain.catch(() => {}).then(run));

export async function connectCalendar(c: Cal.ExpoCalendar) {
  const prev = useStore.getState().settings.calendarSync;
  useStore.getState().updateSettings({ calendarSync: { calendarId: c.id, title: c.title, eventIds: [] } });
  if (prev) await removeEvents(prev.eventIds);
  return syncCalendar();
}

export async function disconnectCalendar() {
  const prev = useStore.getState().settings.calendarSync;
  useStore.getState().updateSettings({ calendarSync: undefined });
  await chain.catch(() => {});
  if (prev) await removeEvents(prev.eventIds);
}
