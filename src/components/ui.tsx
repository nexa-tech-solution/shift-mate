import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '@/lib/haptics';
import { SHIFT_PALETTE, font, radius, space, useTheme } from '@/theme';
import { SHIFT_COLORS, type ShiftColor } from '@/store/types';
import { Icon, type IconName } from './Icon';

/* ---------- Text ---------- */

type Variant = 'hero' | 'display' | 'title' | 'headline' | 'body' | 'label' | 'caption' | 'num' | 'overline';
const variants: Record<Variant, TextStyle> = {
  hero: { fontFamily: font.display, fontSize: 56, lineHeight: 58, letterSpacing: -2 },
  display: { fontFamily: font.display, fontSize: 34, lineHeight: 38, letterSpacing: -1 },
  title: { fontFamily: font.displayBold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  headline: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.body, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: font.medium, fontSize: 14, lineHeight: 19 },
  caption: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17 },
  num: { fontFamily: font.semibold, fontSize: 15, fontVariant: ['tabular-nums'] },
  overline: { fontFamily: font.semibold, fontSize: 11.5, letterSpacing: 1.1, textTransform: 'uppercase' },
};

export function T({
  v = 'body',
  color,
  muted,
  style,
  ...rest
}: TextProps & { v?: Variant; color?: string; muted?: boolean | 2 }) {
  const t = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={v === 'hero' || v === 'display' ? 1.3 : 1.8}
      style={[variants[v], { color: color ?? (muted === 2 ? t.ink3 : muted ? t.ink2 : t.ink) }, style]}
      {...rest}
    />
  );
}

/* ---------- Pressables ---------- */

export function Tap({
  children,
  style,
  onPress,
  feedback = 'tap',
  scaleTo = 0.97,
  ...rest
}: PressableProps & { style?: StyleProp<ViewStyle>; feedback?: 'tap' | 'select' | 'none'; scaleTo?: number }) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPressIn={() => s.set(withSpring(scaleTo, { damping: 20, stiffness: 400 }))}
      onPressOut={() => s.set(withSpring(1, { damping: 15, stiffness: 300 }))}
      onPress={(e) => {
        if (feedback !== 'none') haptic(feedback);
        onPress?.(e);
      }}
      {...rest}
      // style lives on the pressable itself so flex/percentage layout props apply to the touch target
      style={[style, anim]}
    >
      {children as ReactNode}
    </AnimatedPressable>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = { primary: t.ink, secondary: t.surface2, ghost: 'transparent', danger: t.danger + '18' }[kind];
  const fg = { primary: t.bg, secondary: t.ink, ghost: t.ink, danger: t.danger }[kind];
  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={[styles.button, { backgroundColor: bg, opacity: disabled ? 0.4 : 1 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={17} color={fg} />}
          <T v="headline" color={fg}>
            {title}
          </T>
        </>
      )}
    </Tap>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  tone = 'plain',
  size = 44,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'plain' | 'filled' | 'accent';
  size?: number;
}) {
  const t = useTheme();
  const bg = tone === 'accent' ? t.accent : tone === 'filled' ? t.surface2 : 'transparent';
  const fg = tone === 'accent' ? t.onAccent : t.ink;
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={6}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon name={icon} size={size * 0.42} color={fg} />
    </Tap>
  );
}

/* ---------- Layout ---------- */

export function Screen({
  children,
  scroll = true,
  padTop = true,
  header,
  ...rest
}: ScrollViewProps & { scroll?: boolean; padTop?: boolean; header?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: header ? 0 : padTop ? insets.top + space.sm : space.lg, paddingHorizontal: space.lg, paddingBottom: insets.bottom + 96 };
  const body = !scroll ? (
    <View style={[{ flex: 1, backgroundColor: t.bg }, pad]}>{children}</View>
  ) : (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.bg }}
      contentContainerStyle={pad}
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior={padTop ? 'never' : 'automatic'}
      {...rest}
    >
      {children}
    </ScrollView>
  );
  if (!header) return body;
  // header sits outside the ScrollView so it stays put while content scrolls
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingTop: insets.top + space.sm, paddingHorizontal: space.lg }}>{header}</View>
      {body}
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={[
        { backgroundColor: t.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: t.line },
        padded && { padding: space.lg },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T v="overline" muted accessibilityRole="header">
        {title}
      </T>
      {action}
    </View>
  );
}

/** Grouped list row (settings style). */
export function Row({
  icon,
  label,
  value,
  onPress,
  right,
  danger,
  locked,
  last,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  locked?: boolean;
  last?: boolean;
}) {
  const t = useTheme();
  const body = (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }]}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: danger ? t.danger + '18' : t.surface2 }]}>
          <Icon name={icon} size={16} color={danger ? t.danger : t.ink} />
        </View>
      )}
      <T v="label" color={danger ? t.danger : undefined} style={{ flex: 1 }}>
        {label}
      </T>
      {value != null && (
        <T v="label" muted numberOfLines={1} style={{ maxWidth: '50%' }}>
          {value}
        </T>
      )}
      {locked && <ProBadge />}
      {right}
      {onPress && !right && <Icon name="right" size={13} color={t.ink3} />}
    </View>
  );
  if (!onPress) return body;
  return (
    <Tap onPress={onPress} scaleTo={0.99} accessibilityLabel={value ? `${label}, ${value}` : label}>
      {body}
    </Tap>
  );
}

export function ToggleRow({ label, value, onChange, icon, last, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; last?: boolean; hint?: string }) {
  const t = useTheme();
  return (
    <View style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.line }]}>
      {icon && (
        <View style={[styles.rowIcon, { backgroundColor: t.surface2 }]}>
          <Icon name={icon} size={16} color={t.ink} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T v="label">{label}</T>
        {hint && <T v="caption" muted>{hint}</T>}
      </View>
      <Switch
        value={value}
        onValueChange={(v) => {
          haptic('select');
          onChange(v);
        }}
        trackColor={{ true: t.accent, false: t.surface2 }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function ProBadge() {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.accent + '1F', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill }}>
      <Icon name="sparkle" size={10} color={t.accent} />
      <T v="overline" color={t.accent} style={{ fontSize: 10, letterSpacing: 0.6 }}>
        Pro
      </T>
    </View>
  );
}

/* ---------- Inputs ---------- */

export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.segmented, { backgroundColor: t.surface2 }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => {
              if (!on) haptic('select');
              onChange(o.value);
            }}
            style={[styles.segment, on && { backgroundColor: t.surface, shadowColor: '#000', shadowOpacity: t.isDark ? 0 : 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1 }]}
          >
            <T v="label" color={on ? t.ink : t.ink2} style={on ? { fontFamily: font.semibold } : undefined}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  prefix,
  suffix,
  multiline,
  autoFocus,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  prefix?: string;
  suffix?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  error?: string;
}) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <T v="caption" muted style={{ fontFamily: font.medium }}>
        {label}
      </T>
      <View
        style={[
          styles.field,
          { backgroundColor: t.surface, borderColor: error ? t.danger : focus ? t.ink : t.line },
          multiline && { minHeight: 88, alignItems: 'flex-start', paddingVertical: 12 },
        ]}
      >
        {prefix && <T v="headline" muted>{prefix}</T>}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.ink3}
          keyboardType={keyboardType}
          multiline={multiline}
          autoFocus={autoFocus}
          accessibilityLabel={label}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          selectionColor={t.accent}
          style={{ flex: 1, color: t.ink, fontFamily: font.medium, fontSize: 16, paddingVertical: 0, minHeight: 22 }}
        />
        {suffix && <T v="label" muted>{suffix}</T>}
      </View>
      {error && <T v="caption" color={t.danger}>{error}</T>}
    </View>
  );
}

export function ColorPicker({ value, onChange }: { value: ShiftColor; onChange: (c: ShiftColor) => void }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Color">
      {SHIFT_COLORS.map((c) => {
        const on = c === value;
        return (
          <Tap
            key={c}
            feedback="select"
            onPress={() => onChange(c)}
            accessibilityRole="radio"
            accessibilityLabel={SHIFT_PALETTE[c].label}
            accessibilityState={{ selected: on }}
            style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2.5, borderColor: on ? t.ink : 'transparent', alignItems: 'center', justifyContent: 'center' }}
          >
            <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: SHIFT_PALETTE[c].fill, alignItems: 'center', justifyContent: 'center' }}>
              {on && <Icon name="check" size={14} color={SHIFT_PALETTE[c].on} />}
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, color }: { label: string; selected?: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  return (
    <Tap
      feedback="select"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      style={[styles.chip, { backgroundColor: selected ? t.ink : t.surface, borderColor: selected ? t.ink : t.line }]}
    >
      {color && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />}
      <T v="label" color={selected ? t.bg : t.ink}>
        {label}
      </T>
    </Tap>
  );
}

/** Header for modal screens: Cancel · Title · Save. */
export function ModalHeader({ title, onCancel, onSave, saveLabel = 'Save', saveDisabled }: { title: string; onCancel: () => void; onSave?: () => void; saveLabel?: string; saveDisabled?: boolean }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    // iOS modals are page sheets below the status bar; Android modals are full screen
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, paddingTop: (Platform.OS === 'android' ? insets.top : 0) + space.md, paddingBottom: space.sm, backgroundColor: t.bg }}>
      <Pressable onPress={onCancel} hitSlop={8} accessibilityRole="button" style={{ minWidth: 72, minHeight: 44, justifyContent: 'center', paddingHorizontal: space.sm }}>
        <T v="label" muted>Cancel</T>
      </Pressable>
      <T v="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{title}</T>
      <View style={{ minWidth: 72, alignItems: 'flex-end' }}>
        {onSave && (
          <Pressable
            onPress={onSave}
            disabled={saveDisabled}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityState={{ disabled: !!saveDisabled }}
            style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: saveDisabled ? t.surface2 : t.ink }}
          >
            <T v="label" color={saveDisabled ? t.ink3 : t.bg} style={{ fontFamily: font.semibold }}>{saveLabel}</T>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Grouped container for rows/pickers. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Card padded={false} style={[{ overflow: 'hidden' }, style]}>{children}</Card>;
}

/* ---------- States ---------- */

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm }}>
      <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: t.surface2, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs }}>
        <Icon name={icon} size={24} color={t.ink2} />
      </View>
      <T v="headline" style={{ textAlign: 'center' }}>{title}</T>
      <T v="body" muted style={{ textAlign: 'center' }}>{body}</T>
      {action && <View style={{ marginTop: space.md }}>{action}</View>}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.sm, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 52, paddingHorizontal: space.lg, paddingVertical: 10 },
  rowIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.pill },
  segment: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: 10 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52, borderWidth: 1.5, borderRadius: radius.md, paddingHorizontal: space.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
});
