import { router } from 'expo-router';
import { View } from 'react-native';
import { ColorDot } from '@/components/shift';
import { Button, EmptyState, Group, Row, SectionHeader, Screen } from '@/components/ui';
import { formatDuration, formatTime } from '@/lib/format';
import { hmToMin } from '@/lib/time';
import { useActiveWorkplaces } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { space } from '@/theme';

export default function Templates() {
  const templates = useStore((s) => s.templates);
  const fmt = useStore((s) => s.settings.timeFormat);
  const workplaces = useActiveWorkplaces();
  const open = (id: string) => router.push({ pathname: '/template/[id]', params: { id } });

  return (
    <Screen padTop={false}>
      {!templates.length && (
        <EmptyState icon="stack" title="No templates yet" body="Templates are your usual shifts. Add one and adding a shift becomes a single tap." />
      )}
      {workplaces.map((w) => {
        const list = templates.filter((x) => x.workplaceId === w.id);
        if (!list.length) return null;
        return (
          <View key={w.id}>
            {workplaces.length > 1 && <SectionHeader title={w.name} />}
            <Group style={{ marginTop: workplaces.length > 1 ? 0 : space.sm }}>
              {list.map((tp, k) => {
                const len = (hmToMin(tp.end) - hmToMin(tp.start) + 1440) % 1440 || 1440;
                return (
                  <Row
                    key={tp.id}
                    label={tp.name}
                    value={`${formatTime(tp.start, fmt)}–${formatTime(tp.end, fmt)} · ${formatDuration(len - tp.breakMin)}`}
                    right={<ColorDot color={tp.color} size={12} />}
                    onPress={() => open(tp.id)}
                    last={k === list.length - 1}
                  />
                );
              })}
            </Group>
          </View>
        );
      })}
      <Button title="New template" icon="plus" onPress={() => open('new')} style={{ marginTop: space.xl }} />
    </Screen>
  );
}
