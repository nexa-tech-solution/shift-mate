import { useState } from 'react';
import { ActionSheetIOS, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { haptic } from '@/lib/haptics';
import { font, radius, space, useTheme } from '@/theme';
import { T } from './ui';

type Opt = { label: string; value: string | number };
const useChoice = create<{ title: string; options: Opt[]; search?: boolean; onPick?: (v: Opt['value']) => void }>(() => ({ title: '', options: [] }));

/** Single choice: native action sheet on iOS, bottom sheet on Android (Alert caps at 3 buttons) or when `search` is on. */
export function choose<V extends string | number>(title: string, options: { label: string; value: V }[], onPick: (v: V) => void, opts: { search?: boolean } = {}) {
  if (Platform.OS === 'ios' && !opts.search) {
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options.map((o) => o.label), 'Cancel'], cancelButtonIndex: options.length }, (i) => {
      if (i < options.length) onPick(options[i].value);
    });
  } else {
    useChoice.setState({ title, options, search: opts.search, onPick: onPick as (v: Opt['value']) => void });
  }
}

/** Mounted once at the root. */
export function ChoiceHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { title, options, search, onPick } = useChoice();
  const [query, setQuery] = useState('');
  const close = () => {
    useChoice.setState({ onPick: undefined });
    setQuery('');
  };
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  return (
    <Modal visible={!!onPick} transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={close} accessibilityLabel="Close" />
        <View style={{ backgroundColor: t.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: space.lg, paddingBottom: insets.bottom + space.md, maxHeight: '70%' }}>
          <T v="headline" style={{ paddingHorizontal: space.xl, paddingBottom: space.sm }} accessibilityRole="header">{title}</T>
          {search && (
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search"
              placeholderTextColor={t.ink3}
              accessibilityLabel={`Search ${title}`}
              autoCapitalize="characters"
              autoCorrect={false}
              clearButtonMode="while-editing"
              selectionColor={t.accent}
              style={{ marginHorizontal: space.lg, marginBottom: space.sm, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: t.surface2, color: t.ink, fontFamily: font.medium, fontSize: 16 }}
            />
          )}
          <ScrollView keyboardShouldPersistTaps="handled">
            {shown.map((o) => (
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
            {!shown.length && <T v="body" muted style={{ paddingHorizontal: space.xl, paddingVertical: space.lg }}>No matches</T>}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
