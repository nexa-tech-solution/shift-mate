import { Column, Text } from '@expo/ui/jetpack-compose';
import { background, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';
import type { ClockWidgetProps } from '@/lib/clock';

// Android layout (iOS uses ClockWidget.ios.tsx). Runs in the widget process: nothing outside this function is available inside it.
// shortcut: Android widgets have no self-ticking text, so this shows the clock-in time instead of a running timer.
const ClockWidget = (p: ClockWidgetProps) => {
  'widget';
  return (
    <Column modifiers={[fillMaxSize(), background('#E0441C'), paddingAll(16)]}>
      <Text color="#FFFFFFCC" style={{ fontSize: 12, fontWeight: '600' }}>{p.label.toUpperCase()}</Text>
      <Text color="#FFFFFF" style={{ fontSize: 30, fontWeight: '700' }} maxLines={1}>{p.big}</Text>
      <Text color="#FFFFFFE6" style={{ fontSize: 13, fontWeight: '500' }} maxLines={2}>{p.sub}</Text>
    </Column>
  );
};

export default createWidget<ClockWidgetProps>('ClockWidget', ClockWidget, { label: 'Next shift', big: 'None', sub: 'Open Shiftly', startedAt: 0 });
