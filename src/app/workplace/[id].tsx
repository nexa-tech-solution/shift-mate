import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { choose } from '@/components/choose';
import { DateField, PickerRow, TimeField } from '@/components/pickers';
import { Button, ColorPicker, Field, Group, Row, SectionHeader, Screen, Segmented, T, ToggleRow } from '@/components/ui';
import { formatRange } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { periodFor } from '@/lib/pay';
import { todayYmd } from '@/lib/time';
import { useIsPremium } from '@/store/selectors';
import type { PayPeriodConfig, PayRules, Workplace } from '@/store/types';
import { newWorkplace, useStore } from '@/store/useStore';
import { space } from '@/theme';

type Kind = PayPeriodConfig['kind'];
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

export default function WorkplaceEditor() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useStore((s) => s.workplaces.find((w) => w.id === id));
  const count = useStore((s) => s.workplaces.length);
  const upsert = useStore((s) => s.upsertWorkplace);
  const removeWp = useStore((s) => s.removeWorkplace);
  const currency = useStore((s) => s.settings.currency);
  const premium = useIsPremium();
  const [w, setW] = useState<Workplace>(existing ?? newWorkplace({ name: '' }));
  const [rate, setRate] = useState(String(w.hourlyRate));
  const r = w.rules;
  const [txt, setTxt] = useState({
    dAfter: String(r.dailyOvertime?.afterHours ?? 8),
    dMult: String(r.dailyOvertime?.multiplier ?? 1.5),
    wAfter: String(r.weeklyOvertime?.afterHours ?? 40),
    wMult: String(r.weeklyOvertime?.multiplier ?? 1.5),
    nExtra: String(r.night?.extraPerHour ?? 1),
    weekend: String(r.weekendMultiplier ?? 1.25),
  });
  const [on, setOn] = useState({ daily: !!r.dailyOvertime, weekly: !!r.weeklyOvertime, night: !!r.night, weekend: !!r.weekendMultiplier });
  const [night, setNight] = useState(r.night ?? { start: '22:00', end: '06:00', extraPerHour: 1 });

  const set = (p: Partial<Workplace>) => setW({ ...w, ...p });
  const setKind = (k: Kind) => {
    const anchor = 'anchor' in w.payPeriod ? w.payPeriod.anchor : todayYmd();
    set({ payPeriod: k === 'weekly' || k === 'biweekly' ? { kind: k, anchor } : k === 'monthly' ? { kind: 'monthly', startDay: 1 } : { kind: 'semimonthly' } });
  };

  const errors: Record<string, string | undefined> = {
    rate: !(num(rate) >= 0) ? 'Enter your hourly rate' : undefined,
    dAfter: on.daily && !(num(txt.dAfter) > 0) ? 'Hours > 0' : undefined,
    dMult: on.daily && !(num(txt.dMult) >= 1) ? '≥ 1' : undefined,
    wAfter: on.weekly && !(num(txt.wAfter) > 0) ? 'Hours > 0' : undefined,
    wMult: on.weekly && !(num(txt.wMult) >= 1) ? '≥ 1' : undefined,
    nExtra: on.night && !(num(txt.nExtra) >= 0) ? 'Amount ≥ 0' : undefined,
    weekend: on.weekend && !(num(txt.weekend) >= 1) ? '≥ 1' : undefined,
  };
  const valid = w.name.trim() && !Object.values(errors).some(Boolean);

  const save = () => {
    if (!valid) return;
    const rules: PayRules = premium
      ? {
          dailyOvertime: on.daily ? { afterHours: num(txt.dAfter), multiplier: num(txt.dMult) } : undefined,
          weeklyOvertime: on.weekly ? { afterHours: num(txt.wAfter), multiplier: num(txt.wMult) } : undefined,
          night: on.night ? { ...night, extraPerHour: num(txt.nExtra) } : undefined,
          weekendMultiplier: on.weekend ? num(txt.weekend) : undefined,
        }
      : w.rules;
    upsert({ ...w, name: w.name.trim(), hourlyRate: num(rate), rules });
    haptic('success');
    router.back();
  };

  const preview = periodFor(todayYmd(), w.payPeriod);
  const tx = (k: keyof typeof txt) => ({ value: txt[k], onChangeText: (v: string) => setTxt({ ...txt, [k]: v }), keyboardType: 'decimal-pad' as const, error: errors[k] });

  return (
    <Screen padTop={false}>
      <Field label="Name" value={w.name} onChangeText={(name) => set({ name })} placeholder="Where do you work?" autoFocus={!existing} />
      <View style={{ height: space.md }} />
      <Field label="Hourly rate" prefix={currency} value={rate} onChangeText={setRate} keyboardType="decimal-pad" error={errors.rate} />

      <SectionHeader title="Color" />
      <ColorPicker value={w.color} onChange={(color) => set({ color })} />

      <SectionHeader title="Pay period" />
      <Segmented<Kind>
        value={w.payPeriod.kind}
        onChange={setKind}
        accessibilityLabel="Pay period"
        options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: '2 weeks' }, { value: 'semimonthly', label: '2×/mo' }, { value: 'monthly', label: 'Monthly' }]}
      />
      <Group style={{ marginTop: space.md }}>
        {'anchor' in w.payPeriod && (
          <PickerRow label="A period starts on">
            <DateField label="Period start date" value={w.payPeriod.anchor} onChange={(anchor) => set({ payPeriod: { ...(w.payPeriod as { kind: 'weekly'; anchor: string }), anchor } })} />
          </PickerRow>
        )}
        {w.payPeriod.kind === 'monthly' && (
          <Row
            label="Starts on day"
            value={String(w.payPeriod.startDay)}
            onPress={() =>
              choose('Period starts on day', Array.from({ length: 28 }, (_, k) => ({ label: String(k + 1), value: k + 1 })), (startDay) => set({ payPeriod: { kind: 'monthly', startDay } }))
            }
          />
        )}
        <Row label="Current period" value={formatRange(preview.start, preview.end)} last />
      </Group>

      <SectionHeader title="Advanced pay rules" />
      {!premium ? (
        <Group>
          <Row icon="rules" label="Overtime, night & weekend rates" locked onPress={() => router.push('/paywall')} last />
        </Group>
      ) : (
        <>
          <T v="caption" muted style={{ marginBottom: space.sm, paddingHorizontal: 4 }}>
            Set these to match your contract. Shiftly doesn’t apply any country’s overtime law automatically.
          </T>
          <Group>
            <ToggleRow label="Daily overtime" value={on.daily} onChange={(daily) => setOn({ ...on, daily })} />
            {on.daily && (
              <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg }}>
                <View style={{ flex: 1 }}><Field label="After hours / day" {...tx('dAfter')} /></View>
                <View style={{ flex: 1 }}><Field label="Rate ×" {...tx('dMult')} /></View>
              </View>
            )}
            <ToggleRow label="Weekly overtime" value={on.weekly} onChange={(weekly) => setOn({ ...on, weekly })} />
            {on.weekly && (
              <View style={{ flexDirection: 'row', gap: space.md, padding: space.lg }}>
                <View style={{ flex: 1 }}><Field label="After hours / week" {...tx('wAfter')} /></View>
                <View style={{ flex: 1 }}><Field label="Rate ×" {...tx('wMult')} /></View>
              </View>
            )}
            <ToggleRow label="Night premium" value={on.night} onChange={(n) => setOn({ ...on, night: n })} />
            {on.night && (
              <>
                <PickerRow label="From"><TimeField label="Night from" value={night.start} onChange={(start) => setNight({ ...night, start })} /></PickerRow>
                <PickerRow label="Until"><TimeField label="Night until" value={night.end} onChange={(end) => setNight({ ...night, end })} /></PickerRow>
                <View style={{ padding: space.lg }}><Field label="Extra per hour" prefix={currency} {...tx('nExtra')} /></View>
              </>
            )}
            <ToggleRow label="Weekend rate" hint="Saturday & Sunday hours" value={on.weekend} onChange={(weekend) => setOn({ ...on, weekend })} last={!on.weekend} />
            {on.weekend && <View style={{ padding: space.lg }}><Field label="Rate ×" {...tx('weekend')} /></View>}
          </Group>
          <T v="caption" muted style={{ marginTop: space.sm, paddingHorizontal: 4 }}>
            When overtime and weekend rates overlap, the higher one applies. Night premium is added on top.
          </T>
        </>
      )}

      <Button title="Save" onPress={save} disabled={!valid} style={{ marginTop: space.xxl }} />
      {existing && count > 1 && (
        <Button
          title="Delete workplace"
          kind="danger"
          icon="trash"
          style={{ marginTop: space.md }}
          onPress={() =>
            Alert.alert(`Delete ${w.name}?`, 'All its shifts, templates and rotations will be deleted too.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => { removeWp(w.id); router.back(); } },
            ])
          }
        />
      )}
    </Screen>
  );
}
