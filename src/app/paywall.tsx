import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, ScrollView, View } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { Button, IconButton, Segmented, T, Tap } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { buy, loadPackages, restore, storeAvailable, usePremium } from '@/lib/purchases';
import { font, radius, space, useTheme } from '@/theme';

type Feature = { icon: IconName; title: string; body: string };
const PRO: Feature[] = [
  { icon: 'repeat', title: 'Custom rotations', body: '4-on-4-off, 2-2-3, any cycle up to 28 days' },
  { icon: 'work', title: 'Multiple workplaces', body: 'Separate rates, periods and colors' },
  { icon: 'rules', title: 'Advanced pay rules', body: 'Your overtime, night and weekend rates' },
  { icon: 'receipt', title: 'Paycheck check', body: 'Compare your stub with the estimate' },
  { icon: 'share', title: 'PDF & CSV reports', body: 'Per-period earnings reports to keep or send' },
];
const BUSINESS: Feature[] = [
  { icon: 'work', title: 'Up to 10 team members', body: 'Invite your staff with a team code' },
  { icon: 'calendar', title: 'Shared live schedule', body: 'Everyone sees the same rota, updated instantly' },
  { icon: 'bell', title: 'Shift assignment & alerts', body: 'Assign shifts, staff get notified' },
  { icon: 'repeat', title: 'Time-off requests', body: 'Request, approve and plan around leave' },
];
const BUSINESS_CONTACT = process.env.EXPO_PUBLIC_BUSINESS_CONTACT;

// Store links are required next to subscription purchase buttons.
const TERMS = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY = process.env.EXPO_PUBLIC_PRIVACY_URL;

export default function Paywall() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { packages, isPremium, error } = usePremium();
  const [loading, setLoading] = useState(storeAvailable);
  const [selected, setSelected] = useState<PurchasesPackage | undefined>();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [plan, setPlan] = useState<'pro' | 'business'>('pro');
  const features = plan === 'pro' ? PRO : BUSINESS;

  useEffect(() => {
    if (!storeAvailable) return;
    loadPackages().then((p) => {
      setSelected(p.find((x) => x.packageType === 'ANNUAL') ?? p[0]);
      setLoading(false);
    });
  }, []);

  const monthly = packages.find((p) => p.packageType === 'MONTHLY');
  const savings = (p: PurchasesPackage) => {
    if (p.packageType !== 'ANNUAL' || !monthly) return undefined;
    const pct = Math.round((1 - p.product.price / (monthly.product.price * 12)) * 100);
    return pct > 0 ? `Save ${pct}%` : undefined;
  };

  const purchase = async () => {
    if (!selected) return;
    setBusy('buy');
    try {
      if ((await buy(selected)) === 'ok') {
        haptic('success');
        router.back();
      }
    } catch (e) {
      Alert.alert('Purchase failed', String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  const doRestore = async () => {
    setBusy('restore');
    try {
      const ok = await restore();
      Alert.alert(ok ? 'Pro restored' : 'Nothing to restore', ok ? undefined : 'No active subscription found for this store account.');
      if (ok) router.back();
    } catch (e) {
      Alert.alert('Restore failed', String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.xl, paddingTop: (Platform.OS === 'android' ? insets.top : 0) + space.lg, paddingBottom: insets.bottom + space.xl }}>
        <View style={{ alignItems: 'flex-end' }}>
          <IconButton icon="close" tone="filled" size={36} label="Close" onPress={() => router.back()} />
        </View>
        <View style={{ marginTop: space.md, marginBottom: space.xl }}>
          <Segmented value={plan} onChange={setPlan} accessibilityLabel="Plan" options={[{ value: 'pro', label: 'Pro' }, { value: 'business', label: 'Business' }]} />
        </View>
        <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: plan === 'pro' ? t.accent : t.ink, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}>
          <Icon name={plan === 'pro' ? 'sparkle' : 'work'} size={30} color={plan === 'pro' ? t.onAccent : t.bg} />
        </View>
        <T v="display" accessibilityRole="header">{plan === 'pro' ? 'Shiftly Pro' : 'Shiftly Business'}</T>
        <T v="body" muted style={{ marginTop: space.sm }}>
          {plan === 'pro'
            ? 'For people with more than one job, rotating schedules, or pay that isn’t just hours × rate.'
            : 'For small teams: one shared rota, shifts assigned in the app, everyone in sync.'}
        </T>

        <View style={{ gap: space.lg, marginVertical: space.xl }}>
          {features.map((f) => (
            <View key={f.title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={f.icon} size={18} color={t.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <T v="headline">{f.title}</T>
                <T v="caption" muted>{f.body}</T>
              </View>
            </View>
          ))}
        </View>

        {plan === 'business' ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: t.surface2, gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <T v="headline">Coming soon</T>
              <T v="caption" muted>planned $9.99 / month</T>
            </View>
            <T v="caption" muted>Business needs team accounts and sync, which we’re building now. Nothing is charged until it launches in the store.</T>
            {BUSINESS_CONTACT && (
              <Button title="Notify me" kind="secondary" icon="bell" onPress={() => Linking.openURL(`mailto:${BUSINESS_CONTACT}?subject=${encodeURIComponent('Shiftly Business waitlist')}`)} style={{ marginTop: space.xs }} />
            )}
          </View>
        ) : isPremium ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: t.money + '1F', flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="check" size={18} color={t.money} />
            <T v="headline" color={t.money}>Pro is active</T>
          </View>
        ) : !storeAvailable ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: t.surface2, gap: 6 }}>
            <T v="headline">Purchases unavailable</T>
            <T v="caption" muted>The App Store / Google Play isn’t reachable from this build. Install Shiftly from the store to subscribe.</T>
          </View>
        ) : loading ? (
          <ActivityIndicator color={t.ink} style={{ marginVertical: space.xl }} />
        ) : packages.length === 0 ? (
          <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: t.surface2, gap: 6 }}>
            <T v="headline">Couldn’t load plans</T>
            <T v="caption" muted>{error ?? 'Check your connection and try again.'}</T>
            <Button title="Retry" kind="secondary" onPress={() => { setLoading(true); loadPackages().then((p) => { setSelected(p.find((x) => x.packageType === 'ANNUAL') ?? p[0]); setLoading(false); }); }} style={{ marginTop: space.sm }} />
          </View>
        ) : (
          <View style={{ gap: space.sm }}>
            {packages.map((p) => {
              const on = selected?.identifier === p.identifier;
              const tag = savings(p);
              const per = p.packageType === 'ANNUAL' ? '/ year' : p.packageType === 'MONTHLY' ? '/ month' : '';
              return (
                <Tap
                  key={p.identifier}
                  feedback="select"
                  onPress={() => setSelected(p)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.product.title}, ${p.product.priceString} ${per}${tag ? `, ${tag}` : ''}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? t.ink : t.line, backgroundColor: t.surface }}
                >
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? t.ink : t.ink3, alignItems: 'center', justifyContent: 'center' }}>
                    {on && <View style={{ width: 11, height: 11, borderRadius: 6, backgroundColor: t.ink }} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="headline">{p.packageType === 'ANNUAL' ? 'Yearly' : p.packageType === 'MONTHLY' ? 'Monthly' : p.product.title}</T>
                    {p.product.introPrice && <T v="caption" muted>{p.product.introPrice.priceString} intro offer</T>}
                  </View>
                  {tag && (
                    <View style={{ backgroundColor: t.accent, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill }}>
                      <T v="overline" color={t.onAccent} style={{ fontSize: 10 }}>{tag}</T>
                    </View>
                  )}
                  <T v="num" style={{ fontFamily: font.bold }}>{p.product.priceString}<T v="caption" muted> {per}</T></T>
                </Tap>
              );
            })}
            <Button title="Continue" onPress={purchase} loading={busy === 'buy'} disabled={!selected || !!busy} style={{ marginTop: space.md, backgroundColor: t.accent }} />
            <T v="caption" muted style={{ textAlign: 'center' }}>Renews automatically until cancelled. Cancel anytime in your store account settings.</T>
          </View>
        )}

        {plan === 'pro' && storeAvailable && !isPremium && (
          <Button title="Restore purchases" kind="ghost" onPress={doRestore} loading={busy === 'restore'} disabled={!!busy} style={{ marginTop: space.sm }} />
        )}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.xl, marginTop: space.md }}>
          <Tap onPress={() => Linking.openURL(TERMS)} accessibilityRole="link" hitSlop={8}><T v="caption" muted>Terms of Use</T></Tap>
          {PRIVACY && <Tap onPress={() => Linking.openURL(PRIVACY)} accessibilityRole="link" hitSlop={8}><T v="caption" muted>Privacy Policy</T></Tap>}
        </View>
      </ScrollView>
    </View>
  );
}
