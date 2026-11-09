import { router } from 'expo-router';
import { Button, EmptyState, Group, Row, Screen, T } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useStore } from '@/store/useStore';
import { space } from '@/theme';

export default function Rotations() {
  const rotations = useStore((s) => s.rotations);
  const hasTemplates = useStore((s) => s.templates.length > 0);
  const open = (id: string) => router.push({ pathname: '/rotation/[id]', params: { id } });

  return (
    <Screen padTop={false}>
      {rotations.length ? (
        <Group style={{ marginTop: space.sm }}>
          {rotations.map((r, k) => (
            <Row
              key={r.id}
              icon="repeat"
              label={r.name}
              value={`${r.pattern.length}-day · from ${formatDate(r.startDate, { month: 'short', day: 'numeric' })}`}
              onPress={() => open(r.id)}
              last={k === rotations.length - 1}
            />
          ))}
        </Group>
      ) : (
        <EmptyState icon="repeat" title="No repeating schedule" body="Set your weekly pattern or a custom rotation like 4-on-4-off once, and it fills your calendar automatically." />
      )}
      <Button title="New rotation" icon="plus" disabled={!hasTemplates} onPress={() => open('new')} style={{ marginTop: space.xl }} />
      {!hasTemplates && (
        <T v="caption" muted style={{ textAlign: 'center', marginTop: space.sm }}>Create a shift template first. Rotations are built from templates.</T>
      )}
    </Screen>
  );
}
