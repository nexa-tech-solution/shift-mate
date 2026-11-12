import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useStore } from '@/store/useStore';
import { saveGoogleCalendarId, savedGoogleCalendarId, signInWithGoogle } from './account';
import { auth, CALENDAR_SCOPE } from './firebase';
import { type GEvent, type GExisting, planSync, toEvent } from './googleEvents';
import { getInstances } from './schedule';
import { addDays, deviceTz, toInstant, todayYmd } from './time';

const API = 'https://www.googleapis.com/calendar/v3';

class GoogleApiError extends Error {
  constructor(readonly status: number, body: string) {
    super(`Google Calendar error ${status}: ${body.slice(0, 200)}`);
  }
}

async function accessToken() {
  // after a cold start the native SDK needs a silent sign-in before it hands out tokens
  if (!GoogleSignin.getCurrentUser()) {
    const res = await GoogleSignin.signInSilently();
    if (res.type !== 'success') throw new Error('Sign in with Google again to sync your calendar.');
  }
  return (await GoogleSignin.getTokens()).accessToken;
}

async function api<T>(path: string, method = 'GET', body?: unknown, retry = true): Promise<T> {
  const token = await accessToken();
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 401 && retry) {
    await GoogleSignin.clearCachedAccessToken(token); // Android caches tokens past expiry
    return api(path, method, body, false);
  }
  if (!res.ok) throw new GoogleApiError(res.status, await res.text());
  return (res.status === 204 ? null : await res.json()) as T;
}

const enc = encodeURIComponent;

/** The dedicated "Shiftly" calendar; recreated if the person deleted it in Google Calendar. */
async function ensureCalendar(id?: string): Promise<string> {
  if (id) {
    try {
      await api(`/calendars/${enc(id)}`);
      return id;
    } catch (e) {
      if (!(e instanceof GoogleApiError) || (e.status !== 404 && e.status !== 410)) throw e;
    }
  }
  const cal = await api<{ id: string }>('/calendars', 'POST', { summary: 'Shiftly', description: 'Your shifts, synced by Shiftly.', timeZone: deviceTz() });
  await saveGoogleCalendarId(cal.id).catch(() => {});
  return cal.id;
}

async function listEvents(cal: string, fromMs: number, toMs: number) {
  const out: GExisting[] = [];
  let page: string | undefined;
  do {
    const q = new URLSearchParams({
      timeMin: new Date(fromMs).toISOString(),
      timeMax: new Date(toMs).toISOString(),
      maxResults: '2500',
      fields: 'items(id,start,extendedProperties),nextPageToken',
      ...(page ? { pageToken: page } : {}),
    });
    const res = await api<{ items?: GExisting[]; nextPageToken?: string }>(`/calendars/${enc(cal)}/events?${q}`);
    out.push(...(res.items ?? []));
    page = res.nextPageToken;
  } while (page);
  return out;
}

async function insert(cal: string, e: GEvent) {
  try {
    await api(`/calendars/${enc(cal)}/events`, 'POST', e);
  } catch (err) {
    // the id was used before (a deleted event keeps it), so bring that event back instead
    if (!(err instanceof GoogleApiError) || err.status !== 409) throw err;
    await api(`/calendars/${enc(cal)}/events/${e.id}`, 'PUT', { ...e, status: 'confirmed' });
  }
}

async function run() {
  const gc = useStore.getState().settings.googleCalendar;
  if (!gc || !auth?.currentUser) return;
  const cal = await ensureCalendar(gc.calendarId);
  if (cal !== gc.calendarId) useStore.getState().updateSettings({ googleCalendar: { calendarId: cal } });

  const st = useStore.getState();
  const from = addDays(todayYmd(), -30);
  const to = addDays(todayYmd(), 120);
  const fromMs = toInstant(from, '00:00', deviceTz());
  const toMs = toInstant(addDays(to, 1), '00:00', deviceTz());
  const templates = Object.fromEntries(st.templates.map((t) => [t.id, t]));
  const wp = new Map(st.workplaces.map((w) => [w.id, w.name]));
  const desired = getInstances(st.shifts, st.rotations, templates, from, to).map((i) => toEvent(i, wp.get(i.workplaceId)));
  // list a day wider than the window so overnight and other-timezone shifts at the edges are seen
  const existing = await listEvents(cal, fromMs - 86_400_000, toMs + 86_400_000);
  const plan = planSync(desired, existing, fromMs, toMs);

  for (const e of plan.insert) await insert(cal, e);
  for (const e of plan.update) await api(`/calendars/${enc(cal)}/events/${e.id}`, 'PUT', e);
  for (const id of plan.remove) {
    await api(`/calendars/${enc(cal)}/events/${id}`, 'DELETE').catch((e) => {
      if (!(e instanceof GoogleApiError) || (e.status !== 404 && e.status !== 410)) throw e;
    });
  }
}

let chain: Promise<unknown> = Promise.resolve();
/** Serialised like the device calendar sync, so overlapping edits never race. */
export const syncGoogleCalendar = () => (chain = chain.catch(() => {}).then(run));

/** Sign in if needed, ask for calendar access only now, then fill the "Shiftly" calendar. False if cancelled. */
export async function connectGoogleCalendar(): Promise<boolean> {
  if (!auth?.currentUser && !(await signInWithGoogle())) return false;
  if (!GoogleSignin.getCurrentUser()) await GoogleSignin.signInSilently();
  if (!GoogleSignin.getCurrentUser()?.scopes.includes(CALENDAR_SCOPE)) {
    const res = await GoogleSignin.addScopes({ scopes: [CALENDAR_SCOPE] });
    if (!res || !isSuccessResponse(res) || !res.data.scopes.includes(CALENDAR_SCOPE)) return false;
  }
  useStore.getState().updateSettings({ googleCalendar: { calendarId: await savedGoogleCalendarId() } });
  await syncGoogleCalendar();
  return true;
}

/** Stop syncing and delete the "Shiftly" calendar with its events, like turning off the device calendar sync. */
export async function disconnectGoogleCalendar() {
  const gc = useStore.getState().settings.googleCalendar;
  useStore.getState().updateSettings({ googleCalendar: undefined });
  await chain.catch(() => {});
  if (!gc?.calendarId) return;
  await api(`/calendars/${enc(gc.calendarId)}`, 'DELETE').catch(() => {});
  await saveGoogleCalendarId(null).catch(() => {});
}
