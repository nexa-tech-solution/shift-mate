import { Platform } from 'react-native';
import type { DataState } from '@/store/useStore';
import ClockWidget from '@/widgets/ClockWidget';
import { widgetProps } from './clock';
import { PAYWALL_ENABLED, usePremium } from './purchases';
import { getInstances } from './schedule';
import { addDays, todayYmd } from './time';

/** Push the clock state and upcoming shifts to the Home Screen widget. */
export function syncWidget(s: DataState) {
  const now = Date.now();
  const today = todayYmd();
  const tm = Object.fromEntries(s.templates.map((t) => [t.id, t]));
  // free tier only uses the first workplace, same as the app's screens
  const premium = usePremium.getState().isPremium || !PAYWALL_ENABLED;
  const visible = new Set((premium ? s.workplaces : s.workplaces.slice(0, 1)).map((w) => w.id));
  const all = getInstances(s.shifts, s.rotations, tm, addDays(today, -1), addDays(today, 14)).filter((i) => visible.has(i.workplaceId));
  const at = (t: number) => widgetProps(s.clock, all.filter((i) => i.endsAt > t), t, s.settings.timeFormat);

  if (Platform.OS !== 'ios') return ClockWidget.updateSnapshot(at(now));
  // iOS switches entries by itself at each shift start/end, so "next shift" stays right while the app is closed
  const times = all.flatMap((i) => [i.startsAt, i.endsAt]).filter((t) => t > now).sort((a, b) => a - b).slice(0, 12);
  ClockWidget.updateTimeline([now, ...times].map((t) => ({ date: new Date(t), props: at(t) })));
}
