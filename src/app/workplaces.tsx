import { router } from 'expo-router';
import { ColorDot } from '@/components/shift';
import { Button, Group, Row, Screen, T } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { useIsPremium } from '@/store/selectors';
import { useStore } from '@/store/useStore';
import { space } from '@/theme';

export default function Workplaces() {
  const all = useStore((s) => s.workplaces);
  const currency = useStore((s) => s.settings.currency);
  const premium = useIsPremium();
  const open = (id: string) => router.push({ pathname: '/workplace/[id]', params: { id } });

  return (
    <Screen padTop={false}>
      {all.length > 0 && (
        <Group style={{ marginTop: space.sm }}>
          {all.map((w, k) => {
            const locked = !premium && k > 0;
            return (
              <Row
                key={w.id}
                label={w.name}
                value={`${formatMoney(w.hourlyRate, currency)}/h`}
                right={<ColorDot color={w.color} size={12} />}
                locked={locked}
                onPress={() => (locked ? router.push('/paywall') : open(w.id))}
                last={k === all.length - 1}
              />
            );
          })}
        </Group>
      )}
      {!premium && all.length > 1 && (
        <T v="caption" muted style={{ marginTop: space.sm, paddingHorizontal: 4 }}>
          Extra workplaces are kept but hidden on the free plan.
        </T>
      )}
      <Button
        title="Add workplace"
        icon={premium || all.length === 0 ? 'plus' : 'lock'}
        style={{ marginTop: space.xl }}
        onPress={() => (premium || all.length === 0 ? open('new') : router.push('/paywall'))}
      />
      {!premium && all.length > 0 && (
        <T v="caption" muted style={{ textAlign: 'center', marginTop: space.sm }}>Multiple workplaces are a Pro feature.</T>
      )}
    </Screen>
  );
}
