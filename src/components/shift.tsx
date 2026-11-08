import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { formatCountdown, formatDate, formatDuration, formatMoney, formatTime } from '@/lib/format';
import { paidMinutes } from '@/lib/schedule';
import { todayYmd, addDays } from '@/lib/time';
import type { ShiftInstance } from '@/store/types';
import { useStore } from '@/store/useStore';
import { SHIFT_PALETTE, font, radius, soft, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { T, Tap } from './ui';

export const dayLabel = (ymd: string) => {
  const today = todayYmd();
  if (ymd === today) return 'Today';
  if (ymd === addDays(today, 1)) return 'Tomorrow';
  if (ymd === addDays(today, -1)) return 'Yesterday';
  return formatDate(ymd, { weekday: 'long', month: 'short', day: 'numeric' });
};

export const ShiftRow = memo(function ShiftRow({
  shift,
  pay,
  onPress,
  showDate,
}: {
  shift: ShiftInstance;
  pay?: number;
  onPress: (s: ShiftInstance) => void;
  showDate?: boolean;
}) {
  const t = useTheme();
  const fmt = useStore((s) => s.settings.timeFormat);
  const currency = useStore((s) => s.settings.currency);
  const c = SHIFT_PALETTE[shift.color];
  const time = `${formatTime(shift.start, fmt)} – ${formatTime(shift.end, fmt)}`;
  const dur = formatDuration(paidMinutes(shift));
  const overnight = shift.end <= shift.start;
  return (
    <Tap
      onPress={() => onPress(shift)}
      scaleTo={0.98}
      accessibilityLabel={`${shift.title}, ${showDate ? dayLabel(shift.date) + ', ' : ''}${time}, ${dur}${pay != null ? `, about ${formatMoney(pay, currency)}` : ''}`}
      accessibilityHint="Opens the shift"
      style={[styles.row, { backgroundColor: t.surface, borderColor: t.line }]}
    >
      <View style={[styles.bar, { backgroundColor: c.fill }]} />
      <View style={{ flex: 1, gap: 2 }}>
        {showDate && <T v="overline" muted>{dayLabel(shift.date)}</T>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <T v="headline" numberOfLines={1} style={{ flexShrink: 1 }}>{shift.title}</T>
          {shift.rotationId && <Icon name="repeat" size={12} color={t.ink3} />}
          {shift.actual && <Icon name="check" size={12} color={t.money} />}
        </View>
        <T v="num" muted style={{ fontSize: 14, fontFamily: font.medium }}>
          {time}
          {overnight ? '  ·  overnight' : ''}
        </T>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <T v="num">{dur}</T>
        {pay != null && <T v="num" color={t.money} style={{ fontSize: 13 }}>{formatMoney(pay, currency)}</T>}
      </View>
    </Tap>
  );
});

/**
 * Signature element: the next shift as a perforated timecard stub.
 * Shows countdown / live progress for the shift in progress.
 */
export function TicketCard({
  shift,
  now,
  workplace,
  pay,
  onPress,
}: {
  shift: ShiftInstance;
  now: number;
  workplace?: string;
  pay?: number;
  onPress: () => void;
}) {
  const t = useTheme();
  const fmt = useStore((s) => s.settings.timeFormat);
  const currency = useStore((s) => s.settings.currency);
  const c = SHIFT_PALETTE[shift.color];
  const live = now >= shift.startsAt;
  const progress = live ? Math.min(1, (now - shift.startsAt) / (shift.endsAt - shift.startsAt)) : 0;
  const status = live ? `Ends in ${formatCountdown(shift.endsAt - now)}` : `Starts in ${formatCountdown(shift.startsAt - now)}`;
  const onSoft = c.on + 'B3';

  return (
    <Tap
      onPress={onPress}
      scaleTo={0.985}
      accessibilityLabel={`${live ? 'Current shift' : 'Next shift'}: ${shift.title}, ${dayLabel(shift.date)}, ${formatTime(shift.start, fmt)} to ${formatTime(shift.end, fmt)}. ${status}.`}
      style={[styles.ticket, { backgroundColor: c.fill }]}
    >
      <View style={{ padding: space.xl, paddingBottom: space.lg, gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={[styles.badge, { backgroundColor: c.on + '1F' }]}>
            {live && <View style={[styles.liveDot, { backgroundColor: c.on }]} />}
            <T v="overline" color={c.on}>{live ? 'On shift now' : dayLabel(shift.date)}</T>
          </View>
          <T v="label" color={onSoft} numberOfLines={1} style={{ flexShrink: 1, marginLeft: 8 }}>{workplace}</T>
        </View>
        <T v="title" color={c.on} numberOfLines={1} style={{ marginTop: space.xs }}>{shift.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 10 }}>
          <T v="hero" color={c.on} style={{ fontVariant: ['tabular-nums'] }}>{formatTime(shift.start, fmt).replace(/ ?[AP]M/, '')}</T>
          {fmt === '12h' && <T v="title" color={onSoft}>{shift.start < '12:00' ? 'AM' : 'PM'}</T>}
          <T v="title" color={onSoft}>→ {formatTime(shift.end, fmt)}</T>
        </View>
      </View>

      {/* perforation */}
      <View style={styles.perfRow} importantForAccessibility="no-hide-descendants">
        <View style={[styles.notch, { backgroundColor: t.bg, left: -12 }]} />
        <View style={[styles.dashes, { borderColor: c.on + '40' }]} />
        <View style={[styles.notch, { backgroundColor: t.bg, right: -12 }]} />
      </View>

      <View style={{ paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.lg, gap: space.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="clock" size={15} color={c.on} />
            <T v="headline" color={c.on}>{status}</T>
          </View>
          <T v="num" color={c.on}>
            {formatDuration(paidMinutes(shift))}
            {pay != null ? `  ·  ${formatMoney(pay, currency)}` : ''}
          </T>
        </View>
        {live && (
          <View style={[styles.track, { backgroundColor: c.on + '2E' }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
            <View style={{ width: `${progress * 100}%`, height: '100%', borderRadius: 3, backgroundColor: c.on }} />
          </View>
        )}
      </View>
    </Tap>
  );
}

export function ColorDot({ color, size = 8 }: { color: keyof typeof SHIFT_PALETTE; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: SHIFT_PALETTE[color].fill }} />;
}

export function TintChip({ color, label }: { color: keyof typeof SHIFT_PALETTE; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: soft(SHIFT_PALETTE[color].fill, t.isDark) }}>
      <ColorDot color={color} />
      <T v="caption" style={{ fontFamily: font.semibold }}>{label}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, paddingLeft: space.md, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, minHeight: 64 },
  bar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  ticket: { borderRadius: radius.xl, overflow: 'hidden' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  perfRow: { height: 24, justifyContent: 'center' },
  notch: { position: 'absolute', width: 24, height: 24, borderRadius: 12, top: 0 },
  dashes: { marginHorizontal: 22, borderTopWidth: 2, borderStyle: 'dashed' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
});
