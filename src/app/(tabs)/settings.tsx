import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Platform, Switch, View } from 'react-native';
import { choose } from '@/components/choose';
import { Icon } from '@/components/Icon';
import { Button, Card, Group, Row, SectionHeader, Screen, Segmented, T, ToggleRow } from '@/components/ui';
import { deleteAccount, signInWithGoogle, signOut, useAccount } from '@/lib/account';
import { connectCalendar, disconnectCalendar, writableCalendars } from '@/lib/calendarSync';
import { EXPORT_FORMATS, exportAs, exportBackup } from '@/lib/export';
import { accountsEnabled } from '@/lib/firebase';
import { connectGoogleCalendar, disconnectGoogleCalendar } from '@/lib/googleCalendar';
import { CURRENCIES } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { requestReminderPermission } from '@/lib/notifications';
import { manageSubscriptions, PAYWALL_ENABLED, restore, storeAvailable } from '@/lib/purchases';
import { addDays, todayYmd } from '@/lib/time';
import { useIsPremium } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { space, useTheme } from '@/theme';

const LEADS = [15, 30, 60, 120, 720];
const leadLabel = (m: number) => (m < 60 ? `${m} min` : `${m / 60} h`);

export default function Settings() {
  const t = useTheme();
  const premium = useIsPremium();
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const counts = { w: useStore((s) => s.workplaces.length), t: useStore((s) => s.templates.length), r: useStore((s) => s.rotations.length) };
  const [restoring, setRestoring] = useState(false);

  const toggleReminders = async (on: boolean) => {
    if (on && !(await requestReminderPermission())) {
      Alert.alert('Notifications are off', 'Allow notifications for Shiftly in Settings to get shift reminders.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
      return;
    }
    update({ reminders: { ...settings.reminders, enabled: on } });
  };

  const doRestore = async () => {
    setRestoring(true);
    try {
      const ok = await restore();
      haptic(ok ? 'success' : 'warning');
      Alert.alert(ok ? 'Pro restored' : 'Nothing to restore', ok ? 'Welcome back.' : 'No active Pro subscription was found for this store account.');
    } catch (e) {
      Alert.alert('Restore failed', String((e as Error).message ?? e));
    } finally {
      setRestoring(false);
    }
  };

  const fail = (e: unknown) => Alert.alert('Export failed', String((e as Error).message ?? e));
  const [calendarBusy, setCalendarBusy] = useState(false);
  const toggleCalendar = async (enabled: boolean) => {
    setCalendarBusy(true);
    try {
      if (!enabled) {
        await disconnectCalendar();
        return;
      }
      const calendars = await writableCalendars();
      if (!calendars.length) {
        Alert.alert('No calendars', 'Add a writable calendar on this device, then try again.');
        return;
      }
      choose('Sync shifts to', calendars.map((c) => ({ label: `${c.title} · ${c.source.name}`, value: c.id })), (id) => {
        const calendar = calendars.find((c) => c.id === id);
        if (!calendar) return;
        setCalendarBusy(true);
        connectCalendar(calendar)
          .catch((error: Error) => Alert.alert('Calendar sync failed', error.message))
          .finally(() => setCalendarBusy(false));
      });
    } catch (error) {
      Alert.alert('Calendar sync failed', String((error as Error).message ?? error));
    } finally {
      setCalendarBusy(false);
    }
  };
  const user = useAccount((s) => s.user);
  const [accountBusy, setAccountBusy] = useState(false);
  const busy = (fn: () => Promise<unknown>, title: string) => async () => {
    setAccountBusy(true);
    try {
      await fn();
    } catch (error) {
      Alert.alert(title, String((error as Error).message ?? error));
    } finally {
      setAccountBusy(false);
    }
  };
  const toggleGoogleCalendar = (on: boolean) =>
    busy(async () => {
      if (!on) return disconnectGoogleCalendar();
      if (await connectGoogleCalendar()) haptic('success');
    }, 'Google Calendar sync failed')();
  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your shifts stay on this phone. Backup and Google Calendar sync stop until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', onPress: busy(signOut, 'Sign out failed') },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete account?', 'Your cloud backup and account are deleted. Shifts on this phone stay. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: busy(async () => { if (await deleteAccount()) Alert.alert('Account deleted'); }, 'Delete account failed') },
    ]);

  const openCalendar = async () => {
    if (Platform.OS === 'web') return;
    // iOS Calendar uses seconds since Apple's reference date (January 1, 2001).
    const url = Platform.OS === 'ios'
      ? `calshow:${Math.floor((Date.now() - Date.UTC(2001, 0, 1)) / 1000)}`
      : `content://com.android.calendar/time/${Date.now()}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Cannot open Calendar', 'Install or enable a calendar app on this device, then try again.');
    }
  };


  return (
    <Screen header={<T v="display" accessibilityRole="header">Settings</T>}>
      {PAYWALL_ENABLED && (
        <>
      <Card style={{ marginTop: space.lg, backgroundColor: premium ? t.surface : t.ink, borderColor: premium ? t.line : t.ink, gap: space.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="sparkle" size={18} color={t.accent} />
          <T v="title" color={premium ? t.ink : t.bg}>{premium ? 'Shiftly Pro' : 'Go Pro'}</T>
        </View>
        <T v="body" color={premium ? t.ink2 : t.bg + 'CC'}>
          {premium ? 'Thanks for supporting Shiftly. All features are unlocked.' : 'Rotations, multiple jobs, overtime & night rules, paycheck checks and CSV reports.'}
        </T>
        {premium ? (
          <Button title="Manage subscription" kind="secondary" onPress={() => manageSubscriptions().catch(() => {})} />
        ) : (
          <Button title="See plans" kind="primary" style={{ backgroundColor: t.accent }} onPress={() => router.push('/paywall')} />
        )}
      </Card>
      {storeAvailable && !premium && (
        <Button title="Restore purchases" kind="ghost" loading={restoring} onPress={doRestore} style={{ marginTop: space.xs }} />
      )}
        </>
      )}

      {accountsEnabled && (
        <>
          <SectionHeader title="Account" />
          <Group>
            {user ? (
              <>
                <Row icon="person" label={user.displayName ?? user.email ?? 'Google account'} value={user.displayName ? (user.email ?? undefined) : undefined} />
                <Row icon="logout" label="Sign out" onPress={accountBusy ? undefined : confirmSignOut} />
                <Row icon="trash" label="Delete account" danger onPress={accountBusy ? undefined : confirmDelete} last />
              </>
            ) : (
              <Row icon="person" label="Sign in with Google" onPress={accountBusy ? undefined : busy(signInWithGoogle, 'Sign-in failed')} last />
            )}
          </Group>
          <T v="caption" muted style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>
            {user ? 'Your shifts are backed up to your account and restored when you sign in on a new phone.' : 'Optional. Back up your shifts and sync them to Google Calendar. Shiftly works fully without an account.'}
          </T>
        </>
      )}

      <SectionHeader title="Work" />
      <Group>
        <Row icon="work" label="Workplaces" value={String(counts.w)} onPress={() => router.push('/workplaces')} />
        <Row icon="stack" label="Shift templates" value={String(counts.t)} onPress={() => router.push('/templates')} />
        <Row icon="repeat" label="Rotations" value={String(counts.r)} onPress={() => router.push('/rotations')} last />
      </Group>

      <SectionHeader title="Reminders" />
      <Group>
        <ToggleRow icon="bell" label="Shift reminders" value={settings.reminders.enabled} onChange={toggleReminders} last={!settings.reminders.enabled} />
        {settings.reminders.enabled && (
          <Row
            icon="clock"
            label="Remind me"
            value={`${leadLabel(settings.reminders.leadMinutes)} before`}
            onPress={() => choose('Remind me before a shift', LEADS.map((l) => ({ label: leadLabel(l), value: l })), (leadMinutes) => update({ reminders: { ...settings.reminders, leadMinutes } }))}
            last
          />
        )}
      </Group>

      <SectionHeader title="Preferences" />
      <Group>
        <Row icon="pay" label="Currency" value={settings.currency} onPress={() => choose('Currency', CURRENCIES.map((c) => ({ label: c, value: c })), (currency) => update({ currency }), { search: true })} />
        <View style={{ padding: space.lg, gap: space.md, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
          <T v="label">Time format</T>
          <Segmented value={settings.timeFormat} onChange={(timeFormat) => update({ timeFormat })} options={[{ value: '12h', label: '1:00 PM' }, { value: '24h', label: '13:00' }]} accessibilityLabel="Time format" />
        </View>
        <View style={{ padding: space.lg, gap: space.md, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
          <T v="label">Week starts on</T>
          <Segmented value={settings.weekStartsOn} onChange={(weekStartsOn) => update({ weekStartsOn })} options={[{ value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }]} accessibilityLabel="Week starts on" />
        </View>
        <View style={{ padding: space.lg, gap: space.md, borderBottomWidth: 0.5, borderBottomColor: t.line }}>
          <T v="label">Appearance</T>
          <Segmented value={settings.theme} onChange={(theme) => update({ theme })} options={[{ value: 'system', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} accessibilityLabel="Appearance" />
        </View>
        <ToggleRow icon="hand" label="Haptics" value={settings.haptics} onChange={(haptics) => update({ haptics })} last />
      </Group>

      <SectionHeader title="Calendar" />
      <Group>
        <Row icon="calendar" label="Device calendar" onPress={openCalendar} last={!accountsEnabled} right={
          <View onTouchEnd={(event) => event.stopPropagation()}><Switch
            accessibilityLabel="Sync shifts to Calendar"
            value={!!settings.calendarSync}
            disabled={calendarBusy || Platform.OS === 'web'}
            onValueChange={toggleCalendar}
            trackColor={{ true: t.accent, false: t.surface2 }}
          /></View>
        } />
        {accountsEnabled && (
          <Row icon="cloud" label="Google Calendar" last right={
            <Switch
              accessibilityLabel="Sync shifts to Google Calendar"
              value={!!settings.googleCalendar}
              disabled={accountBusy}
              onValueChange={toggleGoogleCalendar}
              trackColor={{ true: t.accent, false: t.surface2 }}
            />
          } />
        )}
      </Group>
      <T v="caption" muted style={{ marginTop: space.sm, paddingHorizontal: space.xs }}>
        Device calendar: tap to open it, turn on to pick a calendar on this phone.
        {accountsEnabled ? ' Google Calendar: needs a Google sign-in and adds a separate "Shiftly" calendar to your account.' : ''} Turning sync off removes the synced events.
      </T>

      <SectionHeader title="Your data" />
      <Group>
        <Row icon="share" label="Export backup (JSON)" onPress={() => exportBackup(useStore.getState()).catch(fail)} />
        <Row
          icon="receipt"
          label="Export shifts"
          value="PDF, Excel, CSV"
          locked={!premium}
          onPress={() =>
            premium
              ? choose('Export the last year and next 3 months', EXPORT_FORMATS, (f) => exportAs(f, useStore.getState(), addDays(todayYmd(), -365), addDays(todayYmd(), 90), true).catch(fail))
              : router.push('/paywall')
          }
        />
        <Row
          icon="trash"
          label="Erase all data"
          danger
          onPress={() =>
            Alert.alert('Erase all data?', 'Shifts, workplaces, templates and settings on this device will be deleted. This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Erase', style: 'destructive', onPress: () => useStore.getState().resetAll() },
            ])
          }
          last
        />
      </Group>

      <T v="caption" muted style={{ textAlign: 'center', marginTop: space.xl, paddingHorizontal: space.lg }}>
        Shiftly {Constants.expoConfig?.version} · {user ? 'Backed up to your Google account.' : 'Your data stays on this device.'}{'\n'}Earnings are estimates, not payroll or tax advice.
      </T>
    </Screen>
  );
}
