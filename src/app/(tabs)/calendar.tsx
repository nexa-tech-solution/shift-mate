import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { ShiftRow, dayLabel } from '@/components/shift';
import { Button, IconButton, Screen, Segmented, T, Tap } from '@/components/ui';
import { formatDate, formatDuration, formatHours, formatMoney, formatTime } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { getInstances, instanceOf, overlaps, paidMinutes } from '@/lib/schedule';
import { addDays, DAY_MIN, eachDay, hmToMin, minToHM, startOfWeek, todayYmd, weekday } from '@/lib/time';
import { useActiveWorkplaces, useInstances, useNow, usePeriodData, useTemplateMap } from '@/store/selectors';
import type { Shift, ShiftInstance, YMD } from '@/store/types';
import { uid, useStore } from '@/store/useStore';
import { SHIFT_PALETTE, font, space, useTheme } from '@/theme';

type Mode = 'month' | 'week';
const openShift = (s: ShiftInstance) => router.push({ pathname: '/shift/[id]', params: { id: s.id } });
const monthStart = (ymd: YMD) => `${ymd.slice(0, 8)}01`;

export default function Calendar() {
  const t = useTheme();
  const weekStartsOn = useStore((s) => s.settings.weekStartsOn);
  const today = todayYmd();
  const [mode, setMode] = useState<Mode>('month');
  const [selected, setSelected] = useState(today);
  const [dir, setDir] = useState<1 | -1>(1);
  const now = useNow();

  const range = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(selected, weekStartsOn);
      return { from: s, to: addDays(s, 6) };
    }
    const first = monthStart(selected);
    const from = startOfWeek(first, weekStartsOn);
    const nextMonth = addDays(first, 32).slice(0, 8) + '01';
    const to = addDays(startOfWeek(addDays(nextMonth, -1), weekStartsOn), 6);
    return { from, to };
  }, [mode, selected, weekStartsOn]);

  const wps = useActiveWorkplaces();
  const wpIds = useMemo(() => new Set(wps.map((w) => w.id)), [wps]);
  const raw = useInstances(addDays(range.from, -1), range.to);
  const instances = useMemo(() => raw.filter((i) => wpIds.has(i.workplaceId)), [raw, wpIds]);
  const byDay = useMemo(() => {
    const m = new Map<YMD, ShiftInstance[]>();
    for (const i of instances) m.set(i.date, [...(m.get(i.date) ?? []), i]);
    return m;
  }, [instances]);
  const pd = usePeriodData(wps[0], selected, now);
  const currency = useStore((s) => s.settings.currency);

  const step = (d: 1 | -1) => {
    haptic('select');
    setDir(d);
    if (mode === 'week') setSelected(addDays(selected, 7 * d));
    else {
      const first = monthStart(selected);
      const target = d > 0 ? addDays(first, 32) : addDays(first, -1);
      setSelected(monthStart(target));
    }
  };
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (Math.abs(g.dx) > 60) step(g.dx < 0 ? 1 : -1);
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, selected],
  );

  const dayShifts = byDay.get(selected) ?? [];
  const weekPay = mode === 'week' ? instances.filter((i) => i.date >= range.from).reduce((a, i) => a + (pd?.perShift.get(i.id)?.pay ?? 0), 0) : 0;
  const weekMin = mode === 'week' ? instances.filter((i) => i.date >= range.from).reduce((a, i) => a + paidMinutes(i), 0) : 0;
  const title = mode === 'month'
    ? formatDate(selected, { month: 'long', year: 'numeric' })
    : `${formatDate(range.from, { month: 'short', day: 'numeric' })} – ${formatDate(range.to, { month: 'short', day: 'numeric' })}`;
  const headers = Array.from({ length: 7 }, (_, k) => formatDate(addDays(range.from, k), { weekday: 'narrow' }));
  const entering = (dir > 0 ? SlideInRight : SlideInLeft).duration(240);

  return (
    <Screen header={
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <T v="display" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1 }}>{title}</T>
        <IconButton icon="plus" tone="accent" label="Add shift on selected day" onPress={() => router.push({ pathname: '/shift/quick', params: { date: selected } })} />
      </View>
    }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg }}>
        <View style={{ flex: 1 }}>
          <Segmented<Mode> value={mode} onChange={setMode} accessibilityLabel="Calendar view" options={[{ value: 'month', label: 'Month' }, { value: 'week', label: 'Week' }]} />
        </View>
        <IconButton icon="left" tone="filled" label={mode === 'month' ? 'Previous month' : 'Previous week'} onPress={() => step(-1)} size={40} />
        <IconButton icon="right" tone="filled" label={mode === 'month' ? 'Next month' : 'Next week'} onPress={() => step(1)} size={40} />
      </View>

      <View {...pan.panHandlers}>
        {mode === 'month' && (
          <View style={{ flexDirection: 'row', marginBottom: 6 }} importantForAccessibility="no-hide-descendants">
            {headers.map((h, k) => (
              <T key={k} v="overline" muted={2} style={{ flex: 1, textAlign: 'center' }}>{h}</T>
            ))}
          </View>
        )}
        <Animated.View key={`${mode}${range.from}`} entering={entering}>
          {mode === 'month' ? (
            <MonthGrid from={range.from} to={range.to} month={selected.slice(0, 7)} selected={selected} today={today} byDay={byDay} onSelect={setSelected} />
          ) : (
            <WeekRows from={range.from} today={today} now={now} instances={instances} />
          )}
        </Animated.View>
      </View>

      {selected.slice(0, 7) !== today.slice(0, 7) || mode === 'week' ? (
        <Tap onPress={() => { setDir(selected > today ? -1 : 1); setSelected(today); }} style={{ alignSelf: 'center', marginTop: space.md }} accessibilityLabel="Jump to today" hitSlop={10}>
          <T v="label" color={t.accent}>Today</T>
        </Tap>
      ) : null}

      {mode === 'week' ? (
        <View style={{ marginTop: space.lg, paddingHorizontal: 4, gap: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="headline">{weekMin ? `${formatDuration(weekMin)} this week` : 'No hours this week'}</T>
            {weekPay > 0 && <T v="headline" color={t.money}>{formatMoney(weekPay, currency)}</T>}
          </View>
          <T v="caption" muted>Drag across a day to draw a shift · tap a day to add · tap a shift to edit · hold a shift to move it</T>
        </View>
      ) : (
      <Animated.View key={selected} entering={FadeIn.duration(200)} style={{ marginTop: space.xl, gap: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 4 }}>
          <T v="title">{dayLabel(selected)}</T>
          {dayShifts.length ? (
            <T v="label" muted>{formatDuration(dayShifts.reduce((a, i) => a + paidMinutes(i), 0))}</T>
          ) : null}
        </View>
        {dayShifts.map((s) => (
          <ShiftRow key={s.id} shift={s} pay={pd?.perShift.get(s.id)?.pay} onPress={openShift} />
        ))}
        {!dayShifts.length && (
          <View style={{ paddingVertical: space.lg, alignItems: 'center', gap: space.md }}>
            <T v="body" muted>Day off.</T>
            <Button title="Add shift" kind="secondary" icon="plus" onPress={() => router.push({ pathname: '/shift/quick', params: { date: selected } })} />
          </View>
        )}
        {pd && (
          <T v="caption" muted style={{ textAlign: 'center', marginTop: space.md }}>
            Pay period {formatDate(pd.period.start, { month: 'short', day: 'numeric' })} – {formatDate(pd.period.end, { month: 'short', day: 'numeric' })} · est. {formatMoney(pd.scheduled.pay, currency)}
          </T>
        )}
      </Animated.View>
      )}
    </Screen>
  );
}

function MonthGrid({ from, to, month, selected, today, byDay, onSelect }: { from: YMD; to: YMD; month: string; selected: YMD; today: YMD; byDay: Map<YMD, ShiftInstance[]>; onSelect: (d: YMD) => void }) {
  const t = useTheme();
  const days = eachDay(from, to);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {days.map((d) => {
        const list = byDay.get(d) ?? [];
        const inMonth = d.startsWith(month);
        const isSel = d === selected;
        const isToday = d === today;
        return (
          <Pressable
            key={d}
            onPress={() => { haptic('select'); onSelect(d); }}
            onLongPress={() => { haptic('heavy'); router.push({ pathname: '/shift/quick', params: { date: d } }); }}
            accessibilityRole="button"
            accessibilityState={{ selected: isSel }}
            accessibilityLabel={`${formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' })}${list.length ? `, ${list.length} shift${list.length > 1 ? 's' : ''}: ${list.map((s) => s.title).join(', ')}` : ''}`}
            accessibilityHint="Long press to add a shift"
            style={{ width: `${100 / 7}%`, aspectRatio: 0.82, padding: 2 }}
          >
            <View style={[cal.cell, { backgroundColor: isSel ? t.ink : list.length && inMonth ? t.surface : 'transparent' }]}>
              <View style={[cal.num, isToday && !isSel && { backgroundColor: t.accent + '22' }]}>
              <T v="num" color={isSel ? t.bg : isToday ? t.accent : inMonth ? t.ink : t.ink3} style={{ fontSize: 15, fontFamily: isToday || isSel ? font.bold : font.medium }}>
                {+d.slice(8)}
              </T>
              </View>
              <View style={cal.bars}>
                {list.slice(0, 3).map((s) => (
                  <View key={s.id} style={[cal.bar, { backgroundColor: SHIFT_PALETTE[s.color].fill, opacity: inMonth ? 1 : 0.4 }]} />
                ))}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const ROW_H = 46;
const LABEL_W = 46;
const SNAP = 15;
const SHADOW = { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 6 };

type Seg = { i: ShiftInstance; top: number; bottom: number };
/** A shift being moved: picked up from row `row`, shifted by dMin minutes and dd days. */
type Drag = Seg & { row: number; dMin: number; dd: number };

/** Week as seven compact rows, each a horizontal time track. Drag across a track to draw a new shift. */
function WeekRows({ from, today, now, instances }: { from: YMD; today: YMD; now: number; instances: ShiftInstance[] }) {
  const fmt = useStore((s) => s.settings.timeFormat);
  const [trackW, setTrackW] = useState(0);
  const days = eachDay(from, addDays(from, 6));
  // split overnight shifts at midnight so each part sits on its own day
  const segsFor = (d: YMD): Seg[] =>
    instances.flatMap((i) => {
      const s = hmToMin(i.start);
      const len = Math.round((i.endsAt - i.startsAt) / 60000);
      if (i.date === d) return [{ i, top: s, bottom: Math.min(DAY_MIN, s + len) }];
      if (addDays(i.date, 1) === d && s + len > DAY_MIN) return [{ i, top: 0, bottom: s + len - DAY_MIN }];
      return [];
    });
  const all = days.flatMap(segsFor);
  // only the hours that matter this week (+1h padding, at least 10h), not all 24
  let r0 = all.length ? Math.max(0, (Math.floor(Math.min(...all.map((x) => x.top)) / 60) - 1) * 60) : 7 * 60;
  let r1 = all.length ? Math.min(DAY_MIN, (Math.ceil(Math.max(...all.map((x) => x.bottom)) / 60) + 1) * 60) : 21 * 60;
  if (r1 - r0 < 10 * 60) {
    r0 = Math.max(0, r0 - Math.ceil((10 * 60 - (r1 - r0)) / 120) * 60);
    r1 = Math.min(DAY_MIN, r0 + 10 * 60);
  }
  const span = r1 - r0;
  const step = span > 14 * 60 ? 6 : span > 10 * 60 ? 4 : 2;
  const ticks: number[] = [];
  for (let h = Math.ceil(r0 / 60 / step) * step; h * 60 < r1; h += step) if (h * 60 > r0) ticks.push(h);
  const hourLabel = (h: number) => (fmt === '24h' ? `${h}:00` : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`);
  const nowD = new Date(now);
  const nowMin = nowD.getHours() * 60 + nowD.getMinutes();
  const tm = useTemplateMap();
  const [drag, setDrag] = useState<Drag | null>(null);
  // the gesture's end callback may hold an older render's closure
  const dragRef = useRef<Drag | null>(null);
  const onDrag = (g: Drag | null) => {
    dragRef.current = g;
    setDrag(g);
  };
  const onDrop = () => {
    const g = dragRef.current;
    onDrag(null);
    if (g && (g.dMin || g.dd)) moveShift(g.i, g.dMin, g.dd);
  };
  // a rotation day becomes a standalone shift, like editing it would
  const moveShift = (i: ShiftInstance, dMin: number, dd: number) => {
    const s0 = hmToMin(i.start) + dMin;
    const date = addDays(i.date, dd + Math.floor(s0 / DAY_MIN));
    const { rotationId, startsAt: _a, endsAt: _b, ...base } = i;
    const moved: Shift = { ...base, id: rotationId ? uid() : i.id, date, start: minToHM(s0), end: minToHM(hmToMin(i.end) + dMin) };
    const save = () => {
      const st = useStore.getState();
      if (rotationId) st.detachOccurrence(rotationId, i.date, moved);
      else st.upsertShift(moved);
      haptic('success');
    };
    const st = useStore.getState();
    const clash = overlaps(instanceOf(moved), getInstances(st.shifts, st.rotations, tm, addDays(date, -1), addDays(date, 1)).filter((o) => o.id !== i.id));
    if (!clash.length) return save();
    Alert.alert('Overlapping shift', `This overlaps “${clash[0].title}”.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Move anyway', onPress: save },
    ]);
  };

  return (
    <View>
      <View style={{ height: 16, marginLeft: LABEL_W, marginBottom: 4 }} importantForAccessibility="no-hide-descendants">
        {trackW > 0 && ticks.map((h) => (
          <T key={h} v="caption" muted={2} style={{ position: 'absolute', left: ((h * 60 - r0) / span) * trackW - 22, width: 44, textAlign: 'center', fontSize: 10.5 }}>{hourLabel(h)}</T>
        ))}
      </View>
      {days.map((d, row) => (
        <DayRow key={d} d={d} row={row} today={today} segs={segsFor(d)} r0={r0} r1={r1} ticks={ticks} trackW={trackW} onTrackW={setTrackW} nowMin={d === today ? nowMin : null} drag={drag} onDrag={onDrag} onDrop={onDrop} />
      ))}
    </View>
  );
}

function DayRow({ d, row, today, segs, r0, r1, ticks, trackW, onTrackW, nowMin, drag, onDrag, onDrop }: { d: YMD; row: number; today: YMD; segs: Seg[]; r0: number; r1: number; ticks: number[]; trackW: number; onTrackW: (w: number) => void; nowMin: number | null; drag: Drag | null; onDrag: (g: Drag | null) => void; onDrop: () => void }) {
  const t = useTheme();
  const fmt = useStore((s) => s.settings.timeFormat);
  const [draft, setDraft] = useState<{ a: number; b: number } | null>(null);
  // shortcut: the track's left edge is fixed (screen gutter + label column) on this full-width screen; measure it if the layout changes
  const pageX = space.lg + LABEL_W;
  const span = r1 - r0;
  const x = (m: number) => ((m - r0) / span) * trackW;
  const toMin = (px: number) => {
    const m = r0 + ((px - pageX) / Math.max(1, trackW)) * span;
    return Math.min(r1, Math.max(r0, Math.round(m / SNAP) * SNAP));
  };
  const visible = segs.filter((s) => s.bottom > r0 && s.top < r1);
  const total = segs.reduce((a, s) => a + s.bottom - s.top, 0);
  const isToday = d === today;
  const wk = weekday(d) === 0 || weekday(d) === 6;
  // Pressable isn't gesture-aware: a drop would otherwise also open the shift
  const [g] = useState({ lifted: false, last: '' });
  const moveGesture = (seg: Seg) =>
    Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(250)
      .onStart(() => {
        g.lifted = true;
        g.last = '0,0';
        haptic('heavy');
        onDrag({ ...seg, row, dMin: 0, dd: 0 });
      })
      .onUpdate((e) => {
        const dMin = Math.round(((e.translationX / Math.max(1, trackW)) * span) / SNAP) * SNAP;
        const dd = Math.min(6 - row, Math.max(-row, Math.round(e.translationY / ROW_H)));
        if (`${dMin},${dd}` === g.last) return;
        g.last = `${dMin},${dd}`;
        haptic('select');
        onDrag({ ...seg, row, dMin, dd });
      })
      .onEnd(onDrop)
      .onFinalize(() => drag && onDrag(null));
  const ghost = drag && drag.row + drag.dd === row ? drag : null;

  const pan = useMemo(() => {
    const g0 = { start: 0, last: 0, down: 0 };
    return PanResponder.create({
      // horizontal drags only, so vertical scrolling still works; capture so it wins over taps on blocks
      // remember where the finger first landed — gestureState.x0 is reset to the point where the drag is recognised
      onStartShouldSetPanResponderCapture: (e) => {
        g0.down = e.nativeEvent.pageX;
        return false;
      },
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (_, g) => {
        g0.start = toMin(g0.down || g.x0);
        g0.last = g0.start;
        haptic('heavy');
        setDraft({ a: g0.start, b: g0.start });
      },
      onPanResponderMove: (_, g) => {
        const m = toMin(g.moveX);
        if (m !== g0.last) {
          if (m % 60 === 0) haptic('select');
          g0.last = m;
          setDraft({ a: Math.min(g0.start, m), b: Math.max(g0.start, m) });
        }
      },
      onPanResponderRelease: () => {
        const a = Math.min(g0.start, g0.last);
        const b = Math.max(g0.start, g0.last);
        setDraft(null);
        if (b - a >= 30) {
          haptic('success');
          router.push({ pathname: '/shift/[id]', params: { id: 'new', date: d, start: minToHM(a), end: minToHM(b) } });
        }
      },
      onPanResponderTerminate: () => setDraft(null),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackW, r0, r1, d]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: ROW_H }}>
      <View style={{ width: LABEL_W, alignItems: 'center' }} accessible accessibilityLabel={`${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}, ${total ? formatDuration(total) : 'day off'}`}>
        <T v="overline" color={isToday ? t.accent : t.ink2} style={{ fontSize: 10.5 }}>{formatDate(d, { weekday: 'short' })}</T>
        <T v="num" color={isToday ? t.accent : t.ink} style={{ fontFamily: font.bold, fontSize: 16 }}>{+d.slice(8)}</T>
      </View>
      <View
        {...pan.panHandlers}
        onLayout={(e) => {
          onTrackW(e.nativeEvent.layout.width);
        }}
        style={{ flex: 1, height: ROW_H - 10, borderRadius: 10, backgroundColor: wk ? t.surface2 : t.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: isToday ? t.accent : t.line, overflow: 'hidden' }}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => { haptic('select'); router.push({ pathname: '/shift/quick', params: { date: d } }); }}
          accessibilityRole="button"
          accessibilityLabel={`Add shift on ${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        />
        {trackW > 0 && ticks.map((h) => (
          <View key={h} pointerEvents="none" style={{ position: 'absolute', left: x(h * 60), top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: t.line }} />
        ))}
        {trackW > 0 && visible.map(({ i, top, bottom }, k) => {
          // stacked duplicates would hide each other — badge the top one
          const stacked = visible.filter((o) => o.top < bottom && top < o.bottom).length;
          if (stacked > 1 && visible.findIndex((o) => o.top < bottom && top < o.bottom) !== k) return null;
          const left = x(Math.max(top, r0));
          const w = Math.max(10, x(Math.min(bottom, r1)) - left);
          const c = SHIFT_PALETTE[i.color];
          return (
            <GestureDetector key={i.id + d} gesture={moveGesture({ i, top, bottom })}>
            <Pressable
              onPressIn={() => (g.lifted = false)}
              onPress={() => !g.lifted && openShift(i)}
              accessibilityRole="button"
              accessibilityLabel={`${i.title}, ${formatTime(i.start, fmt)} to ${formatTime(i.end, fmt)}`}
              accessibilityHint="Opens the shift. Edit it there to change its time."
              style={{ position: 'absolute', left, width: w, top: 3, bottom: 3, borderRadius: 7, backgroundColor: c.fill, justifyContent: 'center', paddingHorizontal: 6, opacity: drag?.i.id === i.id ? 0.35 : 1 }}
            >
              <T v="caption" color={c.on} numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 11 }}>
                {w > 90 ? `${formatTime(i.start, fmt)}–${formatTime(i.end, fmt)}` : w > 40 ? formatTime(i.start, fmt) : ''}
                {stacked > 1 ? `  ×${stacked}` : ''}
              </T>
            </Pressable>
            </GestureDetector>
          );
        })}
        {ghost && trackW > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: x(ghost.top + ghost.dMin), width: Math.max(10, x(ghost.bottom) - x(ghost.top)), top: 3, bottom: 3, borderRadius: 7, backgroundColor: SHIFT_PALETTE[ghost.i.color].fill, justifyContent: 'center', paddingHorizontal: 6, ...SHADOW }}>
            <T v="caption" color={SHIFT_PALETTE[ghost.i.color].on} numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 11 }}>
              {formatTime(minToHM(hmToMin(ghost.i.start) + ghost.dMin), fmt)}–{formatTime(minToHM(hmToMin(ghost.i.end) + ghost.dMin), fmt)}
            </T>
          </View>
        )}
        {trackW > 0 && nowMin != null && nowMin > r0 && nowMin < r1 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: x(nowMin) - 1, top: 0, bottom: 0, width: 2, backgroundColor: t.accent }} />
        )}
        {draft && trackW > 0 && (
          <View pointerEvents="none" style={{ position: 'absolute', left: x(draft.a), width: Math.max(2, x(draft.b) - x(draft.a)), top: 3, bottom: 3, borderRadius: 7, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.accent, backgroundColor: t.accent + '26', justifyContent: 'center', paddingHorizontal: 6 }}>
            <T v="caption" color={t.accent} numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 11 }}>
              {formatTime(minToHM(draft.a), fmt)}–{formatTime(minToHM(draft.b), fmt)}
            </T>
          </View>
        )}
        {/* day total in the free space at the track's right end, only if no block is under it */}
        {trackW > 0 && total > 0 && !draft && trackW - x(Math.min(r1, Math.max(...visible.map((v) => v.bottom), r0))) >= 34 && (
          <T v="num" muted pointerEvents="none" style={{ position: 'absolute', right: 8, top: 0, bottom: 0, textAlignVertical: 'center', lineHeight: ROW_H - 10, fontSize: 11.5 }}>{formatHours(total)}</T>
        )}
      </View>
    </View>
  );
}

const cal = StyleSheet.create({
  cell: { flex: 1, borderRadius: 14, alignItems: 'center', paddingTop: 5, gap: 4 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  bars: { flexDirection: 'row', gap: 2, width: '70%', justifyContent: 'center' },
  bar: { flex: 1, maxWidth: 12, height: 4, borderRadius: 2 },
  weekDate: { height: 34, minWidth: 34, paddingHorizontal: 4, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
