import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { choose } from '@/components/choose';
import { Icon } from '@/components/Icon';
import { PickerRow, TimeField } from '@/components/pickers';
import { Button, Chip, Field, Group, IconButton, Row, Segmented, T, Tap, ToggleRow } from '@/components/ui';
import { CURRENCIES, formatDuration, formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { requestReminderPermission } from '@/lib/notifications';
import { hmToMin, startOfWeek, todayYmd } from '@/lib/time';
import type { PayPeriodConfig, ShiftColor, ShiftTemplate } from '@/store/types';
import { newWorkplace, uid, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, radius, space, useTheme } from '@/theme';

type Preset = { name: string; start: string; end: string; breakMin: number; color: ShiftColor; on: boolean };
const PRESETS: Preset[] = [
  { name: 'Morning', start: '06:00', end: '14:00', breakMin: 30, color: 'sun', on: false },
  { name: 'Day', start: '09:00', end: '17:00', breakMin: 30, color: 'ocean', on: true },
  { name: 'Evening', start: '14:00', end: '22:00', breakMin: 30, color: 'ember', on: false },
  { name: 'Night', start: '22:00', end: '06:00', breakMin: 30, color: 'plum', on: false },
];
const STEPS = 4;

export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useStore((s) => s.settings);
  const complete = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState(settings.currency);
  const [kind, setKind] = useState<PayPeriodConfig['kind']>('biweekly');
  const [presets, setPresets] = useState(PRESETS);
  const [reminders, setReminders] = useState(false);
  const [lead, setLead] = useState(60);

  const rateNum = Number(rate.replace(',', '.'));
  const canNext = step !== 1 || (rate.trim() !== '' && rateNum >= 0);

  const finish = () => {
    const anchor = startOfWeek(todayYmd(), settings.weekStartsOn);
    const payPeriod: PayPeriodConfig = kind === 'weekly' || kind === 'biweekly' ? { kind, anchor } : kind === 'monthly' ? { kind, startDay: 1 } : { kind };
    const workplace = newWorkplace({ name: name.trim() || 'My job', hourlyRate: rateNum || 0, payPeriod });
    const templates: ShiftTemplate[] = presets.filter((p) => p.on).map((p) => ({ id: uid(), workplaceId: workplace.id, name: p.name, start: p.start, end: p.end, breakMin: p.breakMin, color: p.color }));
    haptic('success');
    complete({ workplace, templates, settings: { currency, reminders: { enabled: reminders, leadMinutes: lead } } });
  };

  const next = () => {
    haptic('tap');
    if (step === STEPS - 1) finish();
    else setStep(step + 1);
  };

  const toggleReminders = async (on: boolean) => setReminders(on ? await requestReminderPermission() : false);

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      {step > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingLeft: space.sm, paddingRight: space.xl, paddingTop: space.sm }}>
          <IconButton icon="left" label="Back" onPress={() => setStep(step - 1)} />
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }} accessibilityLabel={`Step ${step} of ${STEPS - 1}`}>
            {Array.from({ length: STEPS - 1 }, (_, k) => (
              <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: k < step ? t.ink : t.surface2 }} />
            ))}
          </View>
        </View>
      )}
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: space.xl }} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={step ? FadeInRight.duration(280) : FadeIn.duration(500)} exiting={FadeOutLeft.duration(160)} style={{ flex: 1 }}>
          {step === 0 && <Welcome />}

          {step === 1 && (
            <View style={{ gap: space.lg }}>
              <Heading title="Where do you work?" body="Used for pay estimates. You can change it anytime." />
              <Field label="Workplace" value={name} onChangeText={setName} placeholder="e.g. Corner Café" autoFocus />
              <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Field label="Hourly rate" value={rate} onChangeText={setRate} keyboardType="decimal-pad" placeholder="0.00" />
                </View>
                <Tap onPress={() => choose('Currency', CURRENCIES.map((c) => ({ label: c, value: c })), setCurrency)} accessibilityLabel={`Currency ${currency}`} style={{ minHeight: 52, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: t.surface2, justifyContent: 'center' }}>
                  <T v="headline">{currency}</T>
                </Tap>
              </View>
              <View style={{ gap: 8 }}>
                <T v="caption" muted>How often are you paid?</T>
                <Segmented value={kind} onChange={setKind} accessibilityLabel="Pay period" options={[{ value: 'weekly', label: 'Weekly' }, { value: 'biweekly', label: '2 weeks' }, { value: 'semimonthly', label: '2×/mo' }, { value: 'monthly', label: 'Monthly' }]} />
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={{ gap: space.lg }}>
              <Heading title="Your usual shifts" body="Pick the shifts you work most. They become one-tap buttons." />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {presets.map((p, k) => (
                  <Chip key={p.name} label={p.name} color={SHIFT_PALETTE[p.color].fill} selected={p.on} onPress={() => setPresets(presets.map((x, i) => (i === k ? { ...x, on: !x.on } : x)))} />
                ))}
              </View>
              {presets.some((p) => p.on) ? (
                <Group>
                  {presets.map((p, k) => p.on && (
                    <View key={p.name}>
                      <PickerRow label={`${p.name} starts`}>
                        <TimeField label={`${p.name} start`} value={p.start} onChange={(start) => setPresets(presets.map((x, i) => (i === k ? { ...x, start } : x)))} />
                      </PickerRow>
                      <PickerRow label={`${p.name} ends`}>
                        <TimeField label={`${p.name} end`} value={p.end} onChange={(end) => setPresets(presets.map((x, i) => (i === k ? { ...x, end } : x)))} />
                      </PickerRow>
                    </View>
                  ))}
                </Group>
              ) : (
                <T v="body" muted>No problem — you can add shifts manually or create templates later.</T>
              )}
              <T v="caption" muted>
                {presets.filter((p) => p.on).map((p) => `${p.name}: ${formatTime(p.start, settings.timeFormat)}–${formatTime(p.end, settings.timeFormat)}, ${formatDuration(((hmToMin(p.end) - hmToMin(p.start) + 1440) % 1440 || 1440) - p.breakMin)} paid`).join('\n')}
              </T>
            </View>
          )}

          {step === 3 && (
            <View style={{ gap: space.lg }}>
              <Heading title="Never miss a shift" body="Get a heads-up before each shift. Reminders update when your schedule changes." />
              <Group>
                <ToggleRow icon="bell" label="Shift reminders" value={reminders} onChange={toggleReminders} last={!reminders} />
                {reminders && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: space.lg }}>
                    {[30, 60, 120].map((m) => (
                      <Chip key={m} label={m < 60 ? `${m} min before` : `${m / 60} h before`} selected={lead === m} onPress={() => setLead(m)} />
                    ))}
                  </View>
                )}
              </Group>
              <Group>
                <Row icon="lock" label="No account. Your data stays on this phone." last />
              </Group>
            </View>
          )}
        </Animated.View>
      </ScrollView>
      {/* KeyboardAvoidingView owns paddingBottom, so the safe-area inset lives here */}
      <View style={{ paddingHorizontal: space.xl, paddingTop: space.sm, paddingBottom: Math.max(insets.bottom, space.lg) + space.sm }}>
        <Button title={step === 0 ? 'Set up in a minute' : step === STEPS - 1 ? 'Start using ShiftMate' : 'Continue'} onPress={next} disabled={!canNext} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Heading({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ gap: 8, marginBottom: space.sm }}>
      <T v="display" accessibilityRole="header">{title}</T>
      <T v="body" muted>{body}</T>
    </View>
  );
}

/** Fanned timecard stubs: the brand mark. */
function Welcome() {
  const t = useTheme();
  const cards: { c: ShiftColor; rot: string; x: number; y: number; label: string; time: string; sub: string }[] = [
    { c: 'plum', rot: '-9deg', x: -22, y: 0, label: 'Night', time: '22:00', sub: '8h · overnight' },
    { c: 'ocean', rot: '6deg', x: 20, y: 62, label: 'Day', time: '09:00', sub: '7h 30m' },
    { c: 'ember', rot: '-2deg', x: 0, y: 132, label: 'Next shift', time: '14:00', sub: 'Starts in 2h 15m' },
  ];
  return (
    <View style={{ flex: 1, justifyContent: 'space-between', paddingTop: space.lg }}>
      <View style={{ height: 290, alignItems: 'center' }} importantForAccessibility="no-hide-descendants">
        {cards.map((k, i) => (
          // rotation sits on the wrapper: entering animations replace the animated view's own transform
          <View key={k.label} style={{ position: 'absolute', top: k.y, transform: [{ translateX: k.x }, { rotate: k.rot }] }}>
            <Animated.View
              entering={FadeInDown.delay(100 + i * 130).springify().damping(15)}
              style={{ width: 264, borderRadius: 24, padding: 18, gap: 6, backgroundColor: SHIFT_PALETTE[k.c].fill, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <T v="overline" color={SHIFT_PALETTE[k.c].on + 'CC'}>{k.label}</T>
                <Icon name="clock" size={18} color={SHIFT_PALETTE[k.c].on} />
              </View>
              <T v="display" color={SHIFT_PALETTE[k.c].on} style={{ fontVariant: ['tabular-nums'] }}>{k.time}</T>
              <T v="label" color={SHIFT_PALETTE[k.c].on + 'B3'}>{k.sub}</T>
            </Animated.View>
          </View>
        ))}
      </View>
      <View style={{ gap: space.md, paddingBottom: space.lg }}>
        <T v="hero" accessibilityRole="header" style={{ fontSize: 48, lineHeight: 50 }}>Shifts in.{'\n'}<T v="hero" color={t.accent} style={{ fontSize: 48, lineHeight: 50 }}>Pay out.</T></T>
        <T v="body" muted style={{ fontSize: 17, lineHeight: 24 }}>Plan your shifts, track your hours and see what you’ll earn — every pay period.</T>
      </View>
    </View>
  );
}
