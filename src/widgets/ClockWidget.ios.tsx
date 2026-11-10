import { Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';
import type { ClockWidgetProps } from '@/lib/clock';

// Runs in the widget extension: nothing outside this function is available inside it.
const ClockWidget = (p: ClockWidgetProps) => {
  'widget';
  const big = [font({ size: 30, weight: 'bold', design: 'rounded' }), monospacedDigit(), foregroundStyle('#FFFFFF'), lineLimit(1)];
  return (
    <VStack alignment="leading" spacing={4} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' }), containerBackground('#E0441C', 'widget')]}>
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#FFFFFFCC')]}>{p.label.toUpperCase()}</Text>
      {/* SwiftUI ticks a timer text on its own, so the widget needs no refresh while clocked in */}
      {p.startedAt ? <Text date={new Date(p.startedAt)} dateStyle="timer" modifiers={big} /> : <Text modifiers={big}>{p.big}</Text>}
      <Text modifiers={[font({ size: 13, weight: 'medium' }), foregroundStyle('#FFFFFFE6'), lineLimit(2)]}>{p.startedAt ? `${p.sub} · since ${p.big}` : p.sub}</Text>
    </VStack>
  );
};

export default createWidget<ClockWidgetProps>('ClockWidget', ClockWidget, { label: 'Next shift', big: 'None', sub: 'Open Shiftly', startedAt: 0 });
