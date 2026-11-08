import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { DataState } from '@/store/useStore';
import { formatTime } from './format';
import { getInstances } from './schedule';
import { addDays, todayYmd } from './time';

const CHANNEL = 'shift-reminders';
// iOS keeps at most 64 pending local notifications per app.
const MAX_PENDING = 48;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Shift reminders',
      // eslint-disable-next-line import/namespace -- enum re-exported via export *; tsc verifies it
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Replace all pending reminders with ones matching the current schedule. */
export async function syncReminders(state: DataState) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const { reminders, timeFormat } = state.settings;
  if (!reminders.enabled || !(await Notifications.getPermissionsAsync()).granted) return;

  const templates = Object.fromEntries(state.templates.map((t) => [t.id, t]));
  const now = Date.now();
  const today = todayYmd();
  const upcoming = getInstances(state.shifts, state.rotations, templates, today, addDays(today, 30))
    .map((i) => ({ i, at: i.startsAt - reminders.leadMinutes * 60_000 }))
    .filter(({ at }) => at > now + 5_000)
    .slice(0, MAX_PENDING);

  const wpName = (id: string) => state.workplaces.find((w) => w.id === id)?.name;
  for (const { i, at } of upcoming) {
    const lead = reminders.leadMinutes;
    const when = lead >= 60 ? `${lead / 60 === 1 ? '1 hour' : `${+(lead / 60).toFixed(1)} hours`}` : `${lead} min`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${i.title} in ${when}`,
        body: `${formatTime(i.start, timeFormat)} – ${formatTime(i.end, timeFormat)}${wpName(i.workplaceId) ? ` · ${wpName(i.workplaceId)}` : ''}`,
        data: { shiftId: i.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
    });
  }
}
