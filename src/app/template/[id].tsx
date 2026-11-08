import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { PickerRow, TimeField } from '@/components/pickers';
import { Button, Chip, ColorPicker, Field, Group, ModalHeader, SectionHeader, T } from '@/components/ui';
import { formatDuration } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { hmToMin } from '@/lib/time';
import { useActiveWorkplaces } from '@/store/selectors';
import type { ShiftTemplate } from '@/store/types';
import { uid, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, space, useTheme } from '@/theme';

export default function TemplateEditor() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const workplaces = useActiveWorkplaces();
  const existing = useStore((s) => s.templates.find((x) => x.id === id));
  const upsert = useStore((s) => s.upsertTemplate);
  const remove = useStore((s) => s.removeTemplate);
  const [tp, setTp] = useState<ShiftTemplate>(
    existing ?? { id: uid(), workplaceId: workplaces[0]?.id ?? '', name: '', start: '09:00', end: '17:00', breakMin: 30, color: 'ocean' },
  );
  const set = (p: Partial<ShiftTemplate>) => setTp({ ...tp, ...p });
  const len = (hmToMin(tp.end) - hmToMin(tp.start) + 1440) % 1440 || 1440;
  const valid = tp.name.trim().length > 0 && !!tp.workplaceId;

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ModalHeader
        title={existing ? 'Edit template' : 'New template'}
        onCancel={() => router.back()}
        saveDisabled={!valid}
        onSave={() => {
          upsert({ ...tp, name: tp.name.trim() });
          haptic('success');
          router.back();
        }}
      />
      <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <View style={{ padding: space.lg, borderRadius: 22, backgroundColor: SHIFT_PALETTE[tp.color].fill, marginBottom: space.lg, gap: 4 }}>
          <T v="title" color={SHIFT_PALETTE[tp.color].on}>{tp.name || 'Template name'}</T>
          <T v="label" color={SHIFT_PALETTE[tp.color].on + 'B3'}>{formatDuration(len - tp.breakMin)} paid{tp.end <= tp.start ? ' · overnight' : ''}</T>
        </View>
        <Field label="Name" value={tp.name} onChangeText={(name) => set({ name })} placeholder="Opening, Close, Night…" autoFocus={!existing} />
        {workplaces.length > 1 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.md }}>
            {workplaces.map((w) => (
              <Chip key={w.id} label={w.name} selected={w.id === tp.workplaceId} onPress={() => set({ workplaceId: w.id })} />
            ))}
          </View>
        )}
        <SectionHeader title="Hours" />
        <Group>
          <PickerRow label="Starts"><TimeField label="Start" value={tp.start} onChange={(start) => set({ start })} /></PickerRow>
          <PickerRow label={tp.end <= tp.start ? 'Ends (next day)' : 'Ends'} last><TimeField label="End" value={tp.end} onChange={(end) => set({ end })} /></PickerRow>
        </Group>
        <SectionHeader title="Unpaid break" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[0, 15, 30, 45, 60].map((b) => (
            <Chip key={b} label={b ? `${b} min` : 'None'} selected={tp.breakMin === b} onPress={() => set({ breakMin: b })} />
          ))}
        </View>
        <SectionHeader title="Color" />
        <ColorPicker value={tp.color} onChange={(color) => set({ color })} />
        {existing && (
          <Button
            title="Delete template"
            kind="danger"
            icon="trash"
            style={{ marginTop: space.xxl }}
            onPress={() =>
              Alert.alert('Delete template?', 'Existing shifts stay. Rotation days using it become days off.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { remove(tp.id); router.back(); } },
              ])
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
