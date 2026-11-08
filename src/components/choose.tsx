import { ActionSheetIOS, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { haptic } from '@/lib/haptics';
import { radius, space, useTheme } from '@/theme';
import { T } from './ui';

type Opt = { label: string; value: string | number };
const useChoice = create<{ title: string; options: Opt[]; onPick?: (v: Opt['value']) => void }>(() => ({ title: '', options: [] }));

/** Single choice: native action sheet on iOS, bottom sheet on Android (Alert caps at 3 buttons). */
export function choose<V extends string | number>(title: string, options: { label: string; value: V }[], onPick: (v: V) => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (i) => {
      if (i < options.length) onPick(options[i].value);
    });
  } else {
    useChoice.setState({ title, options, onPick: onPick as (v: Opt['value']) => void });
  }
}

/** Mounted once at the root. */
export function ChoiceHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { title, options, onPick } = useChoice();
  const close = () => useChoice.setState({ onPick: undefined });
  return (
    <Modal visible={!!onPick} transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={close} accessibilityLabel="Close" />
      <View style={{ backgroundColor: t.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space.lg, paddingBottom: insets.bottom + space.md, maxHeight: '70%' }}>
        <T v="headline" style={{ paddingHorizontal: space.xl, paddingBottom: space.sm }} accessibilityRole="header">{title}</T>
        <ScrollView>
          {options.map((o) => (
            <Pressable
              key={String(o.value)}
              android_ripple={{ color: t.overlay }}
              accessibilityRole="button"
              onPress={() => {
                haptic('select');
                onPick?.(o.value);
                close();
              }}
              style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: space.xl }}
            >
              <T v="body">{o.label}</T>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
