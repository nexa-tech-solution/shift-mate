import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

// SF Symbols on iOS, Material Symbols on Android — native glyphs on each platform.
const ICONS = {
  home: { ios: 'house.fill', android: 'home' },
  calendar: { ios: 'calendar', android: 'calendar_month' },
  pay: { ios: 'banknote', android: 'payments' },
  settings: { ios: 'gearshape', android: 'settings' },
  plus: { ios: 'plus', android: 'add' },
  left: { ios: 'chevron.left', android: 'chevron_left' },
  right: { ios: 'chevron.right', android: 'chevron_right' },
  close: { ios: 'xmark', android: 'close' },
  clock: { ios: 'clock', android: 'schedule' },
  moon: { ios: 'moon.fill', android: 'dark_mode' },
  sun: { ios: 'sun.max.fill', android: 'light_mode' },
  bell: { ios: 'bell', android: 'notifications' },
  repeat: { ios: 'arrow.triangle.2.circlepath', android: 'autorenew' },
  work: { ios: 'briefcase', android: 'work' },
  stack: { ios: 'square.stack', android: 'layers' },
  trash: { ios: 'trash', android: 'delete' },
  check: { ios: 'checkmark', android: 'check' },
  sparkle: { ios: 'sparkles', android: 'auto_awesome' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share' },
  note: { ios: 'note.text', android: 'notes' },
  lock: { ios: 'lock.fill', android: 'lock' },
  coffee: { ios: 'cup.and.saucer', android: 'coffee' },
  up: { ios: 'arrow.up.right', android: 'trending_up' },
  down: { ios: 'arrow.down.right', android: 'trending_down' },
  edit: { ios: 'pencil', android: 'edit' },
  info: { ios: 'info.circle', android: 'info' },
  rules: { ios: 'slider.horizontal.3', android: 'tune' },
  receipt: { ios: 'doc.text', android: 'receipt_long' },
  palette: { ios: 'paintpalette', android: 'palette' },
  globe: { ios: 'globe', android: 'language' },
  hand: { ios: 'hand.tap', android: 'touch_app' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} weight="semibold" />;
}
