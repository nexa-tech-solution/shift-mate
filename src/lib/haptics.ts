import * as Haptics from 'expo-haptics';
import { useStore } from '@/store/useStore';

type Kind = 'tap' | 'select' | 'success' | 'warning' | 'heavy';

export function haptic(kind: Kind = 'tap') {
  if (!useStore.getState().settings.haptics) return;
  switch (kind) {
    case 'tap':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    case 'heavy':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    case 'select':
      return Haptics.selectionAsync().catch(() => {});
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }
}
