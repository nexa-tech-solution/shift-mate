import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { DateField, PickerRow } from '@/components/pickers';
import { Button, Chip, Field, Group, IconButton, ModalHeader, ProBadge, SectionHeader, T, Tap, ToggleRow } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { rotationTemplateFor } from '@/lib/schedule';
import { addDays, deviceTz, startOfWeek, todayYmd } from '@/lib/time';
import { useActiveWorkplaces, useIsPremium, useTemplateMap } from '@/store/selectors';
import type { Rotation } from '@/store/types';
import { uid, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, font, radius, space, useTheme } from '@/theme';

export default function RotationEditor() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const premium = useIsPremium();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const existing = useStore((s) => s.rotations.find((r) => r.id === id));
  const upsert = useStore((s) => s.upsertRotation);
  const removeRot = useStore((s) => s.removeRotation);
  const workplaces = useActiveWorkplaces();
  const allTemplates = useStore((s) => s.templates);
  const tm = useTemplateMap();
  const [r, setR] = useState<Rotation>(
    existing ?? {
      id: uid(),
      workplaceId: workplaces[0]?.id ?? '',
      name: 'My week',
      startDate: startOfWeek(todayYmd(), weekStartsOn),
      pattern: Array(7).fill(null),
      tz: deviceTz(),
      exceptions: [],
    },
  );
  const set = (p: Partial<Rotation>) => setR({ ...r, ...p });
  const templates = allTemplates.filter((x) => x.workplaceId === r.workplaceId);
  const weekly = r.pattern.length === 7;
  const customLocked = !premium && !weekly;

  const cycle = (k: number) => {
    const ids = [null, ...templates.map((x) => x.id)];
    const next = ids[(ids.indexOf(r.pattern[k]) + 1) % ids.length];
    haptic('select');
    set({ pattern: r.pattern.map((p, i) => (i === k ? next : p)) });
  };
  const resize = (n: number) => {
    if (n < 1 || n > 28) return;
    if (!premium && n !== 7) return router.push('/paywall');
    haptic('select');
    set({ pattern: Array.from({ length: n }, (_, i) => r.pattern[i] ?? null) });
  };

  const valid = r.name.trim() && r.pattern.some(Boolean) && !customLocked && (!r.endDate || r.endDate >= r.startDate);
  const preview = Array.from({ length: 14 }, (_, k) => addDays(todayYmd() > r.startDate ? todayYmd() : r.startDate, k));

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ModalHeader
        title={existing ? 'Edit rotation' : 'New rotation'}
        onCancel={() => router.back()}
        saveDisabled={!valid}
        onSave={() => {
          upsert({ ...r, name: r.name.trim() });
          haptic('success');
          router.back();
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Field label="Name" value={r.name} onChangeText={(name) => set({ name })} />
        {workplaces.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
            {workplaces.map((w) => (
              <Chip key={w.id} label={w.name} selected={w.id === r.workplaceId} onPress={() => set({ workplaceId: w.id, pattern: r.pattern.map(() => null) })} />
            ))}
          </View>
        )}

        <SectionHeader
          title={weekly ? 'Weekly pattern' : `${r.pattern.length}-day cycle`}
          action={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {!premium && <ProBadge />}
              <IconButton icon="left" size={34} tone="filled" label="Shorter cycle" onPress={() => resize(r.pattern.length - 1)} />
              <T v="num" style={{ minWidth: 22, textAlign: 'center' }}>{r.pattern.length}</T>
              <IconButton icon="right" size={34} tone="filled" label="Longer cycle" onPress={() => resize(r.pattern.length + 1)} />
            </View>
          }
        />
        <T v="caption" muted style={{ marginBottom: space.md, paddingHorizontal: 4 }}>
          Tap a day to cycle through your templates. {premium ? 'Use any cycle length, e.g. 8 days for 4-on-4-off.' : 'Custom-length rotations are Pro.'}
        </T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {r.pattern.map((p, k) => {
            const tp = p ? tm[p] : undefined;
            const c = tp ? SHIFT_PALETTE[tp.color] : undefined;
            const label = weekly ? formatDate(addDays(r.startDate, k), { weekday: 'short' }) : `Day ${k + 1}`;
            return (
              <Tap
                key={k}
                feedback="none"
                onPress={() => cycle(k)}
                accessibilityLabel={`${label}: ${tp ? tp.name : 'off'}`}
                accessibilityHint="Changes the shift for this day"
                style={{ width: 76, height: 76, borderRadius: radius.md, padding: 8, justifyContent: 'space-between', backgroundColor: c?.fill ?? t.surface, borderWidth: c ? 0 : 1, borderColor: t.line, borderStyle: c ? 'solid' : 'dashed' }}
              >
                <T v="overline" color={c ? c.on + 'B3' : t.ink3} style={{ fontSize: 10 }}>{label}</T>
                <T v="label" color={c?.on ?? t.ink3} numberOfLines={2} style={{ fontFamily: font.semibold }}>{tp?.name ?? 'Off'}</T>
              </Tap>
            );
          })}
        </View>
        {!templates.length && <T v="caption" color={t.danger} style={{ marginTop: space.sm }}>This workplace has no templates yet.</T>}

        <SectionHeader title="Dates" />
        <Group>
          <PickerRow label={weekly ? 'Week of' : 'Day 1 is'}>
            <DateField label="Rotation start" value={r.startDate} onChange={(startDate) => set({ startDate })} />
          </PickerRow>
          <ToggleRow label="Ends on a date" value={!!r.endDate} onChange={(v) => set({ endDate: v ? addDays(r.startDate, 90) : undefined })} last={!r.endDate} />
          {r.endDate && (
            <PickerRow label="Last day" last>
              <DateField label="Rotation end" value={r.endDate} onChange={(endDate) => set({ endDate })} />
            </PickerRow>
          )}
        </Group>

        <SectionHeader title="Next two weeks" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {preview.map((d) => {
            const tp = (() => { const x = rotationTemplateFor(r, d); return x ? tm[x] : undefined; })();
            return (
              <View key={d} style={{ width: 44, alignItems: 'center', gap: 6 }}>
                <T v="caption" muted>{formatDate(d, { weekday: 'narrow' })}</T>
                <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: tp ? SHIFT_PALETTE[tp.color].fill : t.surface2 }}>
                  <T v="num" color={tp ? SHIFT_PALETTE[tp.color].on : t.ink3} style={{ fontSize: 13 }}>{+d.slice(8)}</T>
                </View>
              </View>
            );
          })}
        </ScrollView>
        {r.exceptions.length > 0 && (
          <T v="caption" muted style={{ marginTop: space.md }}>{r.exceptions.length} day{r.exceptions.length > 1 ? 's' : ''} edited or removed individually.</T>
        )}

        {existing && (
          <Button
            title="Delete rotation"
            kind="danger"
            icon="trash"
            style={{ marginTop: space.xxl }}
            onPress={() =>
              Alert.alert('Delete rotation?', 'Its shifts disappear from the calendar. Days you edited individually are kept.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { removeRot(r.id); router.back(); } },
              ])
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
