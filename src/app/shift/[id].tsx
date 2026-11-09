import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/components/Icon';
import { DateField, PickerRow, TimeField } from '@/components/pickers';
import { Button, Chip, ColorPicker, Field, Group, ModalHeader, Row, SectionHeader, T, ToggleRow } from '@/components/ui';
import { formatDuration, formatMoney } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { computeEarnings } from '@/lib/pay';
import { expandRotation, getInstances, instanceOf, overlaps, paidMinutes } from '@/lib/schedule';
import { addDays, hmOf, todayYmd } from '@/lib/time';
import { useActiveWorkplaces, useIsPremium, useNow, useTemplateMap } from '@/store/selectors';
import type { Shift } from '@/store/types';
import { blankShift, uid, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, space, useTheme } from '@/theme';

const BREAKS = [0, 15, 30, 45, 60];

export default function ShiftEditor() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ id: string; date?: string; workplaceId?: string; start?: string; end?: string }>();
  const store = useStore();
  const tm = useTemplateMap();
  const workplaces = useActiveWorkplaces();
  const premium = useIsPremium();
  const now = useNow();
  const isNew = p.id === 'new';
  const [rotationId, occDate] = p.id.includes('@') ? p.id.split('@') : [undefined, undefined];
  const rotation = store.rotations.find((r) => r.id === rotationId);

  const initial = useMemo<Shift | undefined>(() => {
    if (isNew) return blankShift({ workplaceId: p.workplaceId || workplaces[0]?.id, date: p.date ?? todayYmd(), ...(p.start && p.end ? { start: p.start, end: p.end } : {}) });
    if (rotation && occDate) {
      const occ = expandRotation(rotation, tm, occDate, occDate)[0];
      // editing a rotation day turns it into a standalone shift with a fresh id
      return occ && { ...occ, id: uid() };
    }
    return store.shifts.find((s) => s.id === p.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [s, setS] = useState<Shift | undefined>(initial);
  const [rate, setRate] = useState(initial?.rateOverride != null ? String(initial.rateOverride) : '');

  if (!s) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        <ModalHeader title="Shift" onCancel={() => router.back()} />
        <T v="body" muted style={{ padding: space.xl }}>This shift no longer exists.</T>
      </View>
    );
  }

  const set = (patch: Partial<Shift>) => setS({ ...s, ...patch });
  const wp = store.workplaces.find((w) => w.id === s.workplaceId);
  const inst = instanceOf({ ...s, rateOverride: rate ? +rate : undefined });
  const est = wp ? computeEarnings([inst], wp, { weekStartsOn: store.settings.weekStartsOn, advanced: premium }).get(inst.id)?.pay : undefined;
  const clash = overlaps(
    inst,
    getInstances(store.shifts, store.rotations, tm, addDays(s.date, -1), addDays(s.date, 1)).filter((o) => o.id !== p.id),
  );
  const rateNum = rate.trim() ? Number(rate.replace(',', '.')) : undefined;
  const rateError = rateNum != null && !(rateNum >= 0) ? 'Enter a valid amount' : undefined;
  const started = inst.startsAt <= now;

  const save = (force = false) => {
    if (!s.title.trim() || rateError) return;
    if (clash.length && !force) {
      Alert.alert('Overlapping shift', `This overlaps “${clash[0].title}”.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save anyway', onPress: () => save(true) },
      ]);
      return;
    }
    const out: Shift = { ...s, title: s.title.trim(), note: s.note?.trim() || undefined, rateOverride: premium ? rateNum : s.rateOverride };
    if (rotation && occDate) store.detachOccurrence(rotation.id, occDate, out);
    else store.upsertShift(out);
    haptic('success');
    router.back();
  };

  const remove = () =>
    Alert.alert(rotation ? 'Remove this day from the rotation?' : 'Delete shift?', rotation ? 'Other days in the rotation stay as they are.' : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (rotation && occDate) store.detachOccurrence(rotation.id, occDate);
          else store.removeShift(s.id);
          haptic('warning');
          router.back();
        },
      },
    ]);

  const applyTemplate = (id: string) => {
    const tp = tm[id];
    set({ start: tp.start, end: tp.end, breakMin: tp.breakMin, color: tp.color, title: tp.name, templateId: tp.id, workplaceId: tp.workplaceId });
  };

  const wpTemplates = store.templates.filter((x) => x.workplaceId === s.workplaceId);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg }}>
      <ModalHeader title={isNew ? 'New shift' : 'Edit shift'} onCancel={() => router.back()} onSave={() => save()} saveDisabled={!s.title.trim() || !!rateError} />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + space.xxl }} keyboardShouldPersistTaps="handled">
        {rotation && (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: space.md, borderRadius: 14, backgroundColor: t.surface2, marginBottom: space.lg }}>
            <Icon name="repeat" size={16} color={t.ink2} />
            <T v="caption" muted style={{ flex: 1 }}>Part of “{rotation.name}”. Changes here apply to this day only.</T>
          </View>
        )}

        {/* live summary */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12, marginBottom: space.md, paddingHorizontal: 4 }}>
          <T v="display" style={{ fontVariant: ['tabular-nums'] }}>{formatDuration(paidMinutes(inst))}</T>
          <T v="label" muted>{(s.actual?.breakMin ?? s.breakMin) ? `paid · ${formatDuration(s.actual?.breakMin ?? s.breakMin)} break off` : 'paid'}</T>
          {est != null && <T v="title" color={t.money} style={{ marginLeft: 'auto', fontVariant: ['tabular-nums'] }}>{formatMoney(est, store.settings.currency)}</T>}
        </View>

        {isNew && wpTemplates.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: space.md }}>
            {wpTemplates.map((tp) => (
              <Chip key={tp.id} label={tp.name} color={SHIFT_PALETTE[tp.color].fill} selected={s.templateId === tp.id} onPress={() => applyTemplate(tp.id)} />
            ))}
          </ScrollView>
        )}

        <Field label="Title" value={s.title} onChangeText={(title) => set({ title })} placeholder="e.g. Opening" error={!s.title.trim() ? 'Give the shift a name' : undefined} />

        {workplaces.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
            {workplaces.map((w) => (
              <Chip key={w.id} label={w.name} color={SHIFT_PALETTE[w.color].fill} selected={w.id === s.workplaceId} onPress={() => set({ workplaceId: w.id })} />
            ))}
          </View>
        )}

        <SectionHeader title="When" />
        <Group>
          <PickerRow label="Date"><DateField label="Date" value={s.date} onChange={(date) => set({ date })} /></PickerRow>
          <PickerRow label="Starts"><TimeField label="Start time" value={s.start} onChange={(start) => set({ start })} /></PickerRow>
          <PickerRow label={s.end <= s.start ? 'Ends (next day)' : 'Ends'} last>
            <TimeField label="End time" value={s.end} onChange={(end) => set({ end })} />
          </PickerRow>
        </Group>
        {clash.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: space.sm, paddingHorizontal: 4 }}>
            <Icon name="info" size={14} color={t.danger} />
            <T v="caption" color={t.danger}>Overlaps “{clash[0].title}”.</T>
          </View>
        )}

        <SectionHeader title="Unpaid break" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {BREAKS.map((b) => (
            <Chip key={b} label={b ? `${b} min` : 'None'} selected={s.breakMin === b} onPress={() => set({ breakMin: b })} />
          ))}
          {!BREAKS.includes(s.breakMin) && <Chip label={`${s.breakMin} min`} selected onPress={() => {}} />}
        </View>

        <SectionHeader title="Color" />
        <ColorPicker value={s.color} onChange={(color) => set({ color })} />

        <SectionHeader title="Actual hours" />
        <Group>
          <ToggleRow
            label="Log actual times"
            hint={s.actual ? undefined : started ? 'Off: counted as worked as scheduled once it ends' : 'Available once you have the real times'}
            value={!!s.actual}
            onChange={(on) => set({ actual: on ? { start: s.start, end: started ? hmOf(new Date(Math.min(Date.now(), inst.endsAt))) : s.end, breakMin: s.breakMin } : undefined })}
            last={!s.actual}
          />
          {s.actual && (
            <>
              <PickerRow label="Clocked in"><TimeField label="Actual start" value={s.actual.start} onChange={(v) => set({ actual: { ...s.actual!, start: v } })} /></PickerRow>
              <PickerRow label="Clocked out"><TimeField label="Actual end" value={s.actual.end} onChange={(v) => set({ actual: { ...s.actual!, end: v } })} /></PickerRow>
              <View style={{ padding: space.lg, gap: 8 }}>
                <T v="caption" muted>Actual unpaid break</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {BREAKS.map((b) => (
                    <Chip key={b} label={b ? `${b}m` : 'None'} selected={s.actual!.breakMin === b} onPress={() => set({ actual: { ...s.actual!, breakMin: b } })} />
                  ))}
                </View>
              </View>
            </>
          )}
        </Group>

        <SectionHeader title="Pay" />
        {premium ? (
          <Field label={`Hourly rate for this shift (default ${wp ? formatMoney(wp.hourlyRate, store.settings.currency) : '—'})`} value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="Use workplace rate" error={rateError} />
        ) : (
          <Group>
            <Row icon="rules" label="Custom rate for this shift" locked onPress={() => router.push('/paywall')} last />
          </Group>
        )}

        <SectionHeader title="Note" />
        <Field label="Note" value={s.note ?? ''} onChangeText={(note) => set({ note })} placeholder="Covering for Sam, bring keys…" multiline />

        {!isNew && <Button title={rotation ? 'Remove this day' : 'Delete shift'} kind="danger" icon="trash" onPress={remove} style={{ marginTop: space.xxl }} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
