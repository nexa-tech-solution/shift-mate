import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ShiftRow, TicketCard } from '@/components/shift';
import { Button, Card, EmptyState, IconButton, SectionHeader, Screen, T, Tap } from '@/components/ui';
import { formatDate, formatHours, formatMoney } from '@/lib/format';
import { nextOrCurrent } from '@/lib/schedule';
import { addDays, todayYmd } from '@/lib/time';
import { useActiveWorkplaces, useInstances, useNow, usePeriodData } from '@/store/selectors';
import type { ShiftInstance } from '@/store/types';
import { useStore } from '@/store/useStore';
import { space, useTheme } from '@/theme';

const greeting = (h: number) => (h < 5 ? 'Late one' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening');
const openShift = (s: ShiftInstance) => router.push({ pathname: '/shift/[id]', params: { id: s.id } });

export default function Home() {
  const t = useTheme();
  const now = useNow(15_000);
  const today = todayYmd();
  const currency = useStore((s) => s.settings.currency);
  const templates = useStore((s) => s.templates);
  const workplaces = useActiveWorkplaces();
  const wpIds = useMemo(() => new Set(workplaces.map((w) => w.id)), [workplaces]);
  // yesterday included so an overnight shift that is still running shows up
  const raw = useInstances(addDays(today, -1), addDays(today, 30));
  const upcoming = useMemo(() => raw.filter((i) => wpIds.has(i.workplaceId) && i.endsAt > now), [raw, wpIds, now]);
  const next = nextOrCurrent(upcoming, now);
  const primary = workplaces[0];
  const pd = usePeriodData(primary, today, now);
  const list = upcoming.filter((i) => i.id !== next?.id && i.date <= addDays(today, 7)).slice(0, 8);
  const wpName = (id: string) => workplaces.find((w) => w.id === id)?.name;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <T v="overline" muted>{formatDate(today, { weekday: 'long', month: 'long', day: 'numeric' })}</T>
          <T v="display" accessibilityRole="header">{greeting(new Date(now).getHours())}</T>
        </View>
        <IconButton icon="plus" tone="accent" size={48} label="Add shift" onPress={() => router.push('/shift/quick')} />
      </View>

      {next ? (
        <Animated.View entering={FadeInDown.duration(350)}>
          <TicketCard shift={next} now={now} workplace={wpName(next.workplaceId)} pay={pd?.perShift.get(next.id)?.pay} onPress={() => openShift(next)} />
        </Animated.View>
      ) : (
        <Card>
          <EmptyState
            icon="calendar"
            title="Nothing scheduled yet"
            body={templates.length ? 'Tap a template to drop your next shift on the calendar.' : 'Add your next shift and ShiftMate will count down to it.'}
            action={<Button title="Add a shift" icon="plus" onPress={() => router.push('/shift/quick')} />}
          />
        </Card>
      )}

      {pd && primary && (
        <Animated.View entering={FadeInDown.delay(60).duration(350)}>
          <SectionHeader title="This pay period" action={<T v="caption" muted>{formatDate(pd.period.start, { month: 'short', day: 'numeric' })} – {formatDate(pd.period.end, { month: 'short', day: 'numeric' })}</T>} />
          <Tap onPress={() => router.navigate('/pay')} scaleTo={0.99} accessibilityLabel={`Pay period: ${formatHours(pd.scheduled.paidMin)} scheduled, ${formatHours(pd.worked.paidMin)} worked, estimated ${formatMoney(pd.scheduled.pay, currency)}`}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Scheduled" value={formatHours(pd.scheduled.paidMin)} />
              <Stat label="Worked" value={formatHours(pd.worked.paidMin)} />
              <Stat label="Est. gross" value={formatMoney(pd.scheduled.pay, currency, { compact: true })} tone={t.money} />
            </View>
          </Tap>
        </Animated.View>
      )}

      <SectionHeader
        title="Coming up"
        action={
          <Tap onPress={() => router.navigate('/calendar')} accessibilityLabel="Open calendar" hitSlop={10}>
            <T v="label" color={t.accent}>Calendar</T>
          </Tap>
        }
      />
      {list.length ? (
        <View style={{ gap: space.sm }}>
          {list.map((s, k) => (
            <Animated.View key={s.id} entering={FadeInDown.delay(100 + k * 30).duration(300)}>
              <ShiftRow shift={s} showDate pay={pd?.perShift.get(s.id)?.pay} onPress={openShift} />
            </Animated.View>
          ))}
        </View>
      ) : (
        <T v="body" muted style={{ paddingHorizontal: 4 }}>
          {next ? 'Nothing else this week.' : 'Your week is clear.'}
        </T>
      )}
    </Screen>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 14, gap: 4 }} padded={false}>
      <T v="caption" muted>{label}</T>
      <T v="title" color={tone} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</T>
    </Card>
  );
}
