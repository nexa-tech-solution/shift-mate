import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';
import { font, useTheme } from '@/theme';

// Screen pads the top safe area itself; native tabs would otherwise flip its ScrollView to automatic insets and double it
const ownInsets = Platform.OS === 'ios';

export default function TabLayout() {
  const t = useTheme();
  return (
    <NativeTabs
      tintColor={t.accent}
      backgroundColor={t.bg}
      indicatorColor={t.surface2}
      labelStyle={{ fontFamily: font.medium, color: t.ink2, selected: { color: t.ink } }}
    >
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets={ownInsets}>
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'sun.horizon', selected: 'sun.horizon.fill' }} md="wb_twilight" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar" disableAutomaticContentInsets={ownInsets}>
        <NativeTabs.Trigger.Label>Calendar</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pay" disableAutomaticContentInsets={ownInsets}>
        <NativeTabs.Trigger.Label>Pay</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'banknote', selected: 'banknote.fill' }} md="payments" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings" disableAutomaticContentInsets={ownInsets}>
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
