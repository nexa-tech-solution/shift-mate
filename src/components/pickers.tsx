import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, View } from 'react-native';
import { formatDate, formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { hmOf, hmToMin, ymdOf } from '@/lib/time';
import type { HM, YMD } from '@/store/types';
import { useStore } from '@/store/useStore';
import { font, radius, useTheme } from '@/theme';
import { T, Tap } from './ui';

const hmDate = (hm: HM) => {
  const m = hmToMin(hm);
  return new Date(2000, 0, 1, Math.floor(m / 60), m % 60);
};
const ymdDate = (ymd: YMD) => new Date(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10), 12);

/** Native time picker: iOS compact inline pill, Android Material dialog. */
export function TimeField({ value, onChange, label }: { value: HM; onChange: (v: HM) => void; label: string }) {
  const t = useTheme();
  const fmt = useStore((s) => s.settings.timeFormat);
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={hmDate(value)}
        mode="time"
        display="compact"
        minuteInterval={5}
        locale={fmt === '24h' ? 'en_GB' : 'en_US'}
        accentColor={t.accent}
        themeVariant={t.isDark ? 'dark' : 'light'}
        accessibilityLabel={label}
        onValueChange={(_, d) => onChange(hmOf(d))}
      />
    );
  }
  return (
    <Pill
      label={label}
      text={formatTime(value, fmt)}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: hmDate(value),
          mode: 'time',
          is24Hour: fmt === '24h',
          design: 'material',
          title: label,
          onValueChange: (_, d) => onChange(hmOf(d)),
        })
      }
    />
  );
}

export function DateField({ value, onChange, label }: { value: YMD; onChange: (v: YMD) => void; label: string }) {
  const t = useTheme();
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={ymdDate(value)}
        mode="date"
        display="compact"
        accentColor={t.accent}
        themeVariant={t.isDark ? 'dark' : 'light'}
        accessibilityLabel={label}
        onValueChange={(_, d) => onChange(ymdOf(d))}
      />
    );
  }
  return (
    <Pill
      label={label}
      text={formatDate(value, { weekday: 'short', month: 'short', day: 'numeric' })}
      onPress={() =>
        DateTimePickerAndroid.open({ value: ymdDate(value), mode: 'date', design: 'material', title: label, onValueChange: (_, d) => onChange(ymdOf(d)) })
      }
    />
  );
}

function Pill({ text, onPress, label }: { text: string; onPress: () => void; label: string }) {
  const t = useTheme();
  return (
    <Tap
      onPress={() => {
        haptic('select');
        onPress();
      }}
      feedback="none"
      accessibilityLabel={`${label}, ${text}`}
      style={{ backgroundColor: t.surface2, borderRadius: radius.sm, paddingHorizontal: 12, minHeight: 40, justifyContent: 'center' }}
    >
      <T v="num" style={{ fontFamily: font.semibold, fontSize: 16 }}>{text}</T>
    </Tap>
  );
}

/** A labelled line holding a picker on the right. */
export function PickerRow({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 54, paddingHorizontal: 16, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: t.line }}>
      <T v="label">{label}</T>
      {children}
    </View>
  );
}
