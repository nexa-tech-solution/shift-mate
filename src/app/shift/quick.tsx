import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { Chip, T, Tap } from '@/components/ui';
import { formatDate, formatDuration, formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { getInstances, instanceOf, overlaps } from '@/lib/schedule';
import { addDays, deviceTz, hmToMin, todayYmd } from '@/lib/time';
import { useActiveWorkplaces, useTemplateMap } from '@/store/selectors';
import { blankShift, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, font, radius, space, useTheme } from '@/theme';

/** Two-tap add: pick a day, tap a template. */
export default function QuickAdd() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string }>();
  const fmt = useStore((s) => s.settings.timeFormat);
  const workplaces = useActiveWorkplaces();
  const allTemplates = useStore((s) => s.templates);
  const tm = useTemplateMap();
  const upsertShift = useStore((s) => s.upsertShift);
  const [date, setDate] = useState(params.date ?? todayYmd());
  const [wpId, setWpId] = useState(workplaces[0]?.id);
  const templates = allTemplates.filter((x) => x.workplaceId === wpId);
  // keep the chosen day in view, with a little context before it
  const start = params.date ? addDays(params.date, -2) : todayYmd();
  const days = Array.from({ length: 21 }, (_, k) => addDays(start, k));

  const add = (tid: string) => {
    const tpl = templates.find((x) => x.id === tid)!;
    const shift = blankShift({ workplaceId: tpl.workplaceId, date, start: tpl.start, end: tpl.end, breakMin: tpl.breakMin, color: tpl.color, title: tpl.name, templateId: tpl.id, tz: deviceTz() });
    const save = () => {
      upsertShift(shift);
      haptic('success');
      router.back();
    };
    const { shifts, rotations } = useStore.getState();
    const clash = overlaps(instanceOf(shift), getInstances(shifts, rotations, tm, addDays(date, -1), addDays(date, 1)));
    if (!clash.length) return save();
    Alert.alert('Overlapping shift', `This overlaps “${clash[0].title}”.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Add anyway', onPress: save },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.bg }} contentContainerStyle={{ paddingTop: space.xl, paddingBottom: insets.bottom + space.lg }}>
      <View style={{ paddingHorizontal: space.xl, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <T v="title" accessibilityRole="header">Add shift</T>
        <T v="label" muted>{formatDate(date, { weekday: 'long', month: 'short', day: 'numeric' })}</T>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: space.md, marginBottom: space.lg }} contentContainerStyle={{ gap: 8, paddingHorizontal: space.xl }}>
        {days.map((d) => {
          const on = d === date;
          return (
            <Tap
              key={d}
              feedback="select"
              onPress={() => setDate(d)}
              accessibilityLabel={formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}
              accessibilityState={{ selected: on }}
              style={{ width: 52, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 2, backgroundColor: on ? t.ink : t.surface, borderWidth: 1, borderColor: on ? t.ink : t.line }}
            >
              <T v="overline" color={on ? t.bg : t.ink2} style={{ fontSize: 10 }}>{formatDate(d, { weekday: 'short' })}</T>
              <T v="title" color={on ? t.bg : t.ink} style={{ fontSize: 20, lineHeight: 24 }}>{+d.slice(8)}</T>
            </Tap>
          );
        })}
      </ScrollView>

      {workplaces.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: space.xl, paddingBottom: space.md }}>
          {workplaces.map((w) => (
            <Chip key={w.id} label={w.name} color={SHIFT_PALETTE[w.color].fill} selected={w.id === wpId} onPress={() => setWpId(w.id)} />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: space.xl }}>
        {templates.map((tpl) => {
          const c = SHIFT_PALETTE[tpl.color];
          const len = (hmToMin(tpl.end) - hmToMin(tpl.start) + 1440) % 1440 || 1440;
          return (
            <Tap
              key={tpl.id}
              onPress={() => add(tpl.id)}
              feedback="none"
              accessibilityLabel={`Add ${tpl.name}, ${formatTime(tpl.start, fmt)} to ${formatTime(tpl.end, fmt)}`}
              style={{ width: '48%', flexGrow: 1, minHeight: 92, borderRadius: radius.lg, padding: space.lg, backgroundColor: c.fill, justifyContent: 'space-between' }}
            >
              <T v="headline" color={c.on} numberOfLines={1}>{tpl.name}</T>
              <View>
                <T v="num" color={c.on} style={{ fontFamily: font.semibold }}>{formatTime(tpl.start, fmt)} – {formatTime(tpl.end, fmt)}</T>
                <T v="caption" color={c.on + 'B3'}>{formatDuration(len - tpl.breakMin)} paid</T>
              </View>
            </Tap>
          );
        })}
        <Tap
          onPress={() => {
            router.back();
            router.push({ pathname: '/shift/[id]', params: { id: 'new', date, workplaceId: wpId ?? '' } });
          }}
          accessibilityLabel="Custom shift"
          style={{ width: '48%', flexGrow: 1, minHeight: 92, borderRadius: radius.lg, padding: space.lg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.ink3, justifyContent: 'space-between' }}
        >
          <Icon name="edit" size={18} color={t.ink} />
          <View>
            <T v="headline">Custom</T>
            <T v="caption" muted>Any times, notes, breaks</T>
          </View>
        </Tap>
      </View>
      {!templates.length && (
        <Tap onPress={() => { router.back(); router.push('/templates'); }} style={{ paddingHorizontal: space.xl, paddingTop: space.lg }} accessibilityLabel="Create a template">
          <T v="label" color={t.accent}>Create a template for one-tap adding →</T>
        </Tap>
      )}
    </ScrollView>
  );
}
