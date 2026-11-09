import { BricolageGrotesque_500Medium, BricolageGrotesque_700Bold, BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChoiceHost } from '@/components/choose';
import { syncCalendar } from '@/lib/calendarSync';
import { syncReminders } from '@/lib/notifications';
import { initPurchases } from '@/lib/purchases';
import { useStore } from '@/store/useStore';
import { font, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Reschedule reminders whenever shifts, rotations, templates or reminder settings change.
let timer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (s.shifts === prev.shifts && s.rotations === prev.rotations && s.templates === prev.templates && s.settings.reminders === prev.settings.reminders && s.settings.timeFormat === prev.settings.timeFormat && s.workplaces === prev.workplaces) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncReminders(useStore.getState()).catch(() => {}), 600);
});

// Mirror shifts into the connected device/Google calendar once edits settle.
let calTimer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((s, prev) => {
  if (!s.settings.calendarSync || (s.shifts === prev.shifts && s.rotations === prev.rotations && s.templates === prev.templates && s.workplaces === prev.workplaces)) return;
  clearTimeout(calTimer);
  calTimer = setTimeout(() => syncCalendar().catch(() => {}), 1500);
});

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const onboarded = useStore((s) => s.settings.onboarded);
  const t = useTheme();

  useEffect(() => {
    initPurchases();
    // reminders roll forward a month at a time; refresh on launch
    syncReminders(useStore.getState()).catch(() => {});
    // the synced window rolls forward too
    syncCalendar().catch(() => {});
  }, []);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(t.bg);
  }, [t.bg]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  const nav = t.isDark ? DarkTheme : DefaultTheme;
  const navTheme = { ...nav, colors: { ...nav.colors, background: t.bg, card: t.bg, text: t.ink, border: t.line, primary: t.accent } };
  const header = {
    headerStyle: { backgroundColor: t.bg },
    headerShadowVisible: false,
    headerTintColor: t.ink,
    headerTitleStyle: { fontFamily: font.semibold, color: t.ink },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: t.bg },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: t.bg }}>
      <ThemeProvider value={navTheme}>
        <StatusBar style={t.isDark ? 'light' : 'dark'} />
        <Stack screenOptions={header}>
          <Stack.Protected guard={onboarded}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="shift/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen
              name="shift/quick"
              options={{ presentation: 'formSheet', headerShown: false, sheetAllowedDetents: [0.6, 0.92], sheetGrabberVisible: true, sheetCornerRadius: 28 }}
            />
            <Stack.Screen name="templates" options={{ title: 'Shift templates' }} />
            <Stack.Screen name="template/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="workplaces" options={{ title: 'Workplaces' }} />
            <Stack.Screen name="workplace/[id]" options={{ title: 'Workplace' }} />
            <Stack.Screen name="rotations" options={{ title: 'Rotations' }} />
            <Stack.Screen name="rotation/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
          </Stack.Protected>
          <Stack.Protected guard={!onboarded}>
            <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade' }} />
          </Stack.Protected>
        </Stack>
        <ChoiceHost />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
