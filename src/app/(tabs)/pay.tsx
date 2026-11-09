import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/Icon';
import { ShiftRow } from '@/components/shift';
import { Button, Card, Chip, EmptyState, Field, Group, IconButton, Row, SectionHeader, Screen, T } from '@/components/ui';
import { EXPORT_FORMATS, exportAs } from '@/lib/export';
import { formatDate, formatHours, formatMoney, formatRange } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { hasAdvancedRules, periodFor, shiftPeriod } from '@/lib/pay';
import { eachDay, todayYmd } from '@/lib/time';
import { useActiveWorkplaces, useIsPremium, useNow, usePeriodData } from '@/store/selectors';
import type { ShiftInstance } from '@/store/types';
import type { PeriodData } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { SHIFT_PALETTE, radius, space, useTheme } from '@/theme';

const openShift = (s: ShiftInstance) => router.push({ pathname: '/shift/[id]', params: { id: s.id } });

export default function Pay() {
  const t = useTheme();
  const now = useNow(60_000);
  const premium = useIsPremium();
  const currency = useStore((s) => s.settings.currency);
  const workplaces = useActiveWorkplaces();
  const [wpId, setWpId] = useState<string | undefined>();
  const wp = workplaces.find((w) => w.id === wpId) ?? workplaces[0];
  const [anchor, setAnchor] = useState(todayYmd());
  const pd = usePeriodData(wp, anchor, now);
  const prevAnchor = wp ? shiftPeriod(periodFor(anchor, wp.payPeriod), wp.payPeriod, -1).start : anchor;
  const prev = usePeriodData(wp, prevAnchor, now);

  if (!wp || !pd) {
    return (
      <Screen>
        <T v="display" accessibilityRole="header">Pay</T>
        <EmptyState icon="work" title="No workplace yet" body="Add a workplace and hourly rate to see estimates." action={<Button title="Add workplace" onPress={() => router.push('/workplaces')} />} />
      </Screen>
    );
  }

  const isCurrent = pd.period.start <= todayYmd() && todayYmd() <= pd.period.end;
  const m = (n: number, compact?: boolean) => formatMoney(n, currency, { compact });
  const progress = pd.scheduled.paidMin ? Math.min(1, pd.worked.paidMin / pd.scheduled.paidMin) : 0;
  const effective = pd.scheduled.paidMin ? pd.scheduled.pay / (pd.scheduled.paidMin / 60) : 0;
  const step = (d: -1 | 1) => {
    haptic('select');
    setAnchor(shiftPeriod(pd.period, wp.payPeriod, d).start);
  };

  return (
    <Screen>
      <T v="display" accessibilityRole="header" style={{ marginBottom: space.md }}>Pay</T>

      {workplaces.length > 1 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md }}>
          {workplaces.map((w) => (
            <Chip key={w.id} label={w.name} color={SHIFT_PALETTE[w.color].fill} selected={w.id === wp.id} onPress={() => setWpId(w.id)} />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
        <IconButton icon="left" tone="filled" size={40} label="Previous pay period" onPress={() => step(-1)} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <T v="headline">{formatRange(pd.period.start, pd.period.end)}</T>
          <T v="caption" muted>{isCurrent ? 'Current period' : pd.period.end < todayYmd() ? 'Past period' : 'Upcoming period'}</T>
        </View>
        <IconButton icon="right" tone="filled" size={40} label="Next pay period" onPress={() => step(1)} />
      </View>

      <Animated.View key={pd.period.start + wp.id} entering={FadeIn.duration(220)}>
        <Card style={{ padding: space.xl, gap: space.md }}>
          <T v="overline" muted>Estimated gross</T>
          <T v="hero" color={t.money} numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }} accessibilityLabel={`Estimated gross ${m(pd.scheduled.pay)}`}>
            {m(pd.scheduled.pay)}
          </T>
          <View style={{ gap: 8 }}>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surface2, overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityLabel="Worked of scheduled hours" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
              <View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: t.money, borderRadius: 4 }} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T v="label"><T v="label" style={{ fontVariant: ['tabular-nums'] }}>{m(pd.worked.pay)}</T><T v="label" muted> earned so far</T></T>
              <T v="label" muted style={{ fontVariant: ['tabular-nums'] }}>{formatHours(pd.worked.paidMin)} / {formatHours(pd.scheduled.paidMin)}</T>
            </View>
          </View>
        </Card>
        <T v="caption" muted style={{ marginTop: space.sm, paddingHorizontal: 4 }}>
          Before taxes and deductions. An estimate from your schedule, not a payroll calculation.
        </T>

        {pd.instances.length > 0 && <DailyChart pd={pd} money={(n) => m(n, true)} />}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
          <Tile label="Scheduled" value={formatHours(pd.scheduled.paidMin)} />
          <Tile label="Worked" value={formatHours(pd.worked.paidMin)} />
          <Tile label="Shifts" value={String(pd.scheduled.shifts)} />
          <Tile label="Avg / hour" value={effective ? m(effective) : '—'} />
          {premium && hasAdvancedRules(wp.rules) && (
            <>
              <Tile label="Overtime" value={formatHours(pd.scheduled.otMin)} />
              <Tile label="Night" value={formatHours(pd.scheduled.nightMin)} />
            </>
          )}
        </View>

        {prev && (prev.scheduled.shifts > 0 || pd.scheduled.shifts > 0) && (
          <>
            <SectionHeader title="Compared with last period" />
            <Card style={{ gap: space.md }}>
              <Delta label="Hours" now={pd.scheduled.paidMin / 60} before={prev.scheduled.paidMin / 60} fmt={(n) => `${n.toFixed(1)}h`} />
              <Delta label="Estimated gross" now={pd.scheduled.pay} before={prev.scheduled.pay} fmt={(n) => m(n)} />
            </Card>
          </>
        )}

        <SectionHeader title="Paycheck check" />
        {premium ? (
          <PaycheckCompare workplaceId={wp.id} periodStart={pd.period.start} estimate={pd.worked.pay || pd.scheduled.pay} />
        ) : (
          <Group>
            <Row icon="receipt" label="Compare with your real paycheck" locked onPress={() => router.push('/paywall')} />
            <Row icon="share" label="Export period report (PDF / Excel / CSV)" locked onPress={() => router.push('/paywall')} last />
          </Group>
        )}
        {premium && (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            {EXPORT_FORMATS.map((f) => (
              <Button
                key={f.value}
                title={f.value === 'pdf' ? 'PDF' : f.value === 'xlsx' ? 'Excel' : 'CSV'}
                kind="secondary"
                icon={f.value === 'pdf' ? 'receipt' : 'share'}
                style={{ flex: 1 }}
                onPress={() => exportAs(f.value, useStore.getState(), pd.period.start, pd.period.end, true).catch((e) => Alert.alert('Export failed', String(e.message ?? e)))}
              />
            ))}
          </View>
        )}

        <SectionHeader title="Shifts in this period" action={<T v="caption" muted>{pd.instances.length}</T>} />
        {pd.instances.length ? (
          <View style={{ gap: space.sm }}>
            {pd.instances.map((s) => (
              <ShiftRow key={s.id} shift={s} showDate pay={pd.perShift.get(s.id)?.pay} onPress={openShift} />
            ))}
          </View>
        ) : (
          <T v="body" muted style={{ paddingHorizontal: 4 }}>No shifts in this period.</T>
        )}

        <Group style={{ marginTop: space.xl }}>
          <Row icon="rules" label="Rate & pay rules" value={`${m(wp.hourlyRate)}/h`} onPress={() => router.push({ pathname: '/workplace/[id]', params: { id: wp.id } })} last />
        </Group>
      </Animated.View>
    </Screen>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <Card padded={false} style={{ width: '48%', flexGrow: 1, padding: 14, gap: 4 }}>
      <T v="caption" muted>{label}</T>
      <T v="title" numberOfLines={1} adjustsFontSizeToFit style={{ fontVariant: ['tabular-nums'] }}>{value}</T>
    </Card>
  );
}

function Delta({ label, now, before, fmt }: { label: string; now: number; before: number; fmt: (n: number) => string }) {
  const t = useTheme();
  const diff = now - before;
  const up = diff >= 0;
  const flat = Math.abs(diff) < 0.005;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} accessible accessibilityLabel={`${label}: ${fmt(now)}, ${flat ? 'same as' : up ? 'up' : 'down'} ${fmt(Math.abs(diff))} from last period`}>
      <View>
        <T v="caption" muted>{label}</T>
        <T v="headline" style={{ fontVariant: ['tabular-nums'] }}>{fmt(now)}</T>
      </View>
      {!flat && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: (up ? t.money : t.danger) + '1F' }}>
          <Icon name={up ? 'up' : 'down'} size={12} color={up ? t.money : t.danger} />
          <T v="num" color={up ? t.money : t.danger} style={{ fontSize: 13 }}>{fmt(Math.abs(diff))}</T>
        </View>
      )}
    </View>
  );
}

function PaycheckCompare({ workplaceId, periodStart, estimate }: { workplaceId: string; periodStart: string; estimate: number }) {
  const t = useTheme();
  const currency = useStore((s) => s.settings.currency);
  const saved = useStore((s) => s.paychecks.find((p) => p.workplaceId === workplaceId && p.periodStart === periodStart));
  const setPaycheck = useStore((s) => s.setPaycheck);
  const [text, setText] = useState(saved ? String(saved.amount) : '');
  const amount = text.trim() ? Number(text.replace(',', '.')) : null;
  const valid = amount == null || (Number.isFinite(amount) && amount >= 0);
  const diff = saved ? saved.amount - estimate : null;
  return (
    <Card style={{ gap: space.md }}>
      <Field
        label="Gross on your pay stub"
        value={text}
        onChangeText={(v) => {
          setText(v);
          const n = v.trim() ? Number(v.replace(',', '.')) : null;
          if (n == null) setPaycheck({ workplaceId, periodStart, amount: null });
          else if (Number.isFinite(n) && n >= 0) setPaycheck({ workplaceId, periodStart, amount: n });
        }}
        keyboardType="decimal-pad"
        placeholder="0.00"
        error={valid ? undefined : 'Enter a valid amount'}
      />
      {diff != null && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="label" muted>vs estimate {formatMoney(estimate, currency)}</T>
          <T v="headline" color={Math.abs(diff) < 0.5 ? t.money : diff < 0 ? t.danger : t.money}>
            {Math.abs(diff) < 0.5 ? 'Matches' : `${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff), currency)}`}
          </T>
        </View>
      )}
      {diff != null && diff < -0.5 && (
        <T v="caption" muted>Lower than expected. Check logged hours, breaks and your rate, or ask your employer.</T>
      )}
    </Card>
  );
}

const CHART_H = 120;

/** Estimated pay per day: solid = worked, faded = still scheduled. */
function DailyChart({ pd, money }: { pd: PeriodData; money: (n: number) => string }) {
  const t = useTheme();
  const today = todayYmd();
  const days = eachDay(pd.period.start, pd.period.end);
  const byDay = new Map<string, { worked: number; sched: number }>();
  for (const i of pd.instances) {
    const v = pd.perShift.get(i.id);
    if (!v) continue;
    const d = byDay.get(i.date) ?? { worked: 0, sched: 0 };
    if (v.worked) d.worked += v.pay;
    else d.sched += v.pay;
    byDay.set(i.date, d);
  }
  const max = Math.max(1, ...[...byDay.values()].map((d) => d.worked + d.sched));
  const labelEvery = days.length > 16 ? 7 : days.length > 7 ? 2 : 1;
  const gap = days.length > 16 ? 2 : 4;
  return (
    <Card style={{ marginTop: space.lg, gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <T v="overline" muted>Daily estimate</T>
        <T v="caption" muted style={{ fontVariant: ['tabular-nums'] }}>peak {money(max)}</T>
      </View>
      <View style={{ height: CHART_H, flexDirection: 'row', alignItems: 'flex-end', gap }}>
        {days.map((d) => {
          const v = byDay.get(d);
          const total = v ? v.worked + v.sched : 0;
          return (
            <View
              key={d}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
              accessible
              accessibilityLabel={`${formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}: ${total ? money(total) : 'no shifts'}`}
            >
              {total > 0 ? (
                <View style={{ height: Math.max(4, (total / max) * CHART_H), borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: t.money + '40' }}>
                  <View style={{ height: `${(v!.worked / total) * 100}%`, backgroundColor: t.money }} />
                </View>
              ) : (
                <View style={{ height: 3, borderRadius: 2, backgroundColor: d === today ? t.accent : t.surface2 }} />
              )}
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap }} importantForAccessibility="no-hide-descendants">
        {days.map((d, k) => (
          <T key={d} v="caption" color={d === today ? t.accent : t.ink3} numberOfLines={1} style={{ flex: 1, textAlign: 'center', fontSize: 10 }}>
            {k % labelEvery === 0 ? (days.length > 7 ? String(+d.slice(8)) : formatDate(d, { weekday: 'narrow' })) : ''}
          </T>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: space.lg }}>
        <Legend color={t.money} label="Worked" />
        <Legend color={t.money + '40'} label="Scheduled" />
      </View>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <T v="caption" muted>{label}</T>
    </View>
  );
}
