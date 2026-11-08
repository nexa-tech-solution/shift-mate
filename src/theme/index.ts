import { useColorScheme } from 'react-native';
import type { ShiftColor } from '@/store/types';
import { useStore } from '@/store/useStore';

/*
 * Identity: "timecard". Warm paper + ink neutrals, a single ember accent,
 * and a perforated ticket stub as the signature shape for the next shift.
 */
const light = {
  bg: '#F4F0E8',
  surface: '#FFFCF7',
  surface2: '#ECE6DB',
  ink: '#1B1814',
  ink2: '#5C554C',
  ink3: '#8A8278',
  line: '#E2DACC',
  accent: '#E0441C',
  onAccent: '#FFFFFF',
  money: '#11804F',
  danger: '#C2321A',
  overlay: 'rgba(27,24,20,0.04)',
};

const dark: typeof light = {
  bg: '#0F0E0C',
  surface: '#1A1815',
  surface2: '#25221E',
  ink: '#F5F0E8',
  ink2: '#B3AA9E',
  ink3: '#7F776C',
  line: '#2F2B26',
  accent: '#FF6B3D',
  onAccent: '#1B0A03',
  money: '#43CC8F',
  danger: '#FF6B57',
  overlay: 'rgba(255,255,255,0.05)',
};

export const SHIFT_PALETTE: Record<ShiftColor, { fill: string; on: string; label: string }> = {
  sun: { fill: '#F2A92E', on: '#2A1A00', label: 'Sun' },
  ember: { fill: '#E8501F', on: '#FFFFFF', label: 'Ember' },
  rose: { fill: '#D9407A', on: '#FFFFFF', label: 'Rose' },
  plum: { fill: '#7357E0', on: '#FFFFFF', label: 'Plum' },
  ocean: { fill: '#2870D6', on: '#FFFFFF', label: 'Ocean' },
  mint: { fill: '#15966A', on: '#FFFFFF', label: 'Mint' },
  slate: { fill: '#566173', on: '#FFFFFF', label: 'Slate' },
};

export type Theme = typeof light & { isDark: boolean };

export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useStore((s) => s.settings.theme);
  const isDark = pref === 'system' ? system === 'dark' : pref === 'dark';
  return isDark ? { ...dark, isDark } : { ...light, isDark };
}

/** Translucent tint of a shift colour for chips/backgrounds. */
export const soft = (hex: string, isDark: boolean) => hex + (isDark ? '38' : '24');

export const font = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_500Medium',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 16, lg: 22, xl: 28, pill: 999 };
