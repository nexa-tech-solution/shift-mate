import Storage from 'expo-sqlite/kv-store';
import { getCalendars, getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { deviceTz, startOfWeek, todayYmd } from '@/lib/time';
import type { ID, Paycheck, Rotation, Settings, Shift, ShiftTemplate, Workplace, YMD } from './types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export interface DataState {
  settings: Settings;
  workplaces: Workplace[];
  templates: ShiftTemplate[];
  shifts: Shift[];
  rotations: Rotation[];
  paychecks: Paycheck[];
}

interface Actions {
  updateSettings: (p: Partial<Settings>) => void;
  upsertWorkplace: (w: Workplace) => void;
  removeWorkplace: (id: ID) => void;
  upsertTemplate: (t: ShiftTemplate) => void;
  removeTemplate: (id: ID) => void;
  upsertShift: (s: Shift) => void;
  removeShift: (id: ID) => void;
  upsertRotation: (r: Rotation) => void;
  removeRotation: (id: ID) => void;
  /** Remove one generated date from a rotation; optionally replace it with a standalone shift. */
  detachOccurrence: (rotationId: ID, date: YMD, replacement?: Shift) => void;
  setPaycheck: (p: Paycheck | { workplaceId: ID; periodStart: YMD; amount: null }) => void;
  completeOnboarding: (p: { workplace: Workplace; templates: ShiftTemplate[]; settings: Partial<Settings> }) => void;
  resetAll: () => void;
}

const locale = getLocales()[0];

const defaultSettings = (): Settings => ({
  currency: locale?.currencyCode ?? 'USD',
  timeFormat: getCalendars()[0]?.uses24hourClock ? '24h' : '12h',
  weekStartsOn: locale?.regionCode === 'US' || locale?.regionCode === 'CA' ? 0 : 1,
  theme: 'system',
  reminders: { enabled: false, leadMinutes: 60 },
  haptics: true,
  onboarded: false,
});

const initialData = (): DataState => ({
  settings: defaultSettings(),
  workplaces: [],
  templates: [],
  shifts: [],
  rotations: [],
  paychecks: [],
});

const upsert = <T extends { id: ID }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item];

export const useStore = create<DataState & Actions>()(
  persist(
    (set) => ({
      ...initialData(),
      updateSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      upsertWorkplace: (w) => set((s) => ({ workplaces: upsert(s.workplaces, w) })),
      removeWorkplace: (id) =>
        set((s) => ({
          workplaces: s.workplaces.filter((w) => w.id !== id),
          templates: s.templates.filter((t) => t.workplaceId !== id),
          shifts: s.shifts.filter((x) => x.workplaceId !== id),
          rotations: s.rotations.filter((r) => r.workplaceId !== id),
          paychecks: s.paychecks.filter((p) => p.workplaceId !== id),
        })),
      upsertTemplate: (t) => set((s) => ({ templates: upsert(s.templates, t) })),
      removeTemplate: (id) =>
        set((s) => ({
          templates: s.templates.filter((t) => t.id !== id),
          // rotations keep their shape; that cycle day simply becomes a day off
          rotations: s.rotations.map((r) => ({ ...r, pattern: r.pattern.map((p) => (p === id ? null : p)) })),
        })),
      upsertShift: (x) => set((s) => ({ shifts: upsert(s.shifts, x) })),
      removeShift: (id) => set((s) => ({ shifts: s.shifts.filter((x) => x.id !== id) })),
      upsertRotation: (r) => set((s) => ({ rotations: upsert(s.rotations, r) })),
      removeRotation: (id) => set((s) => ({ rotations: s.rotations.filter((r) => r.id !== id) })),
      detachOccurrence: (rotationId, date, replacement) =>
        set((s) => ({
          rotations: s.rotations.map((r) =>
            r.id === rotationId && !r.exceptions.includes(date) ? { ...r, exceptions: [...r.exceptions, date] } : r,
          ),
          shifts: replacement ? upsert(s.shifts, replacement) : s.shifts,
        })),
      setPaycheck: (p) =>
        set((s) => {
          const rest = s.paychecks.filter((x) => !(x.workplaceId === p.workplaceId && x.periodStart === p.periodStart));
          return { paychecks: p.amount == null ? rest : [...rest, p as Paycheck] };
        }),
      completeOnboarding: ({ workplace, templates, settings }) =>
        set((s) => ({
          workplaces: [workplace],
          templates,
          settings: { ...s.settings, ...settings, onboarded: true },
        })),
      resetAll: () => set(initialData()),
    }),
    {
      name: 'shiftmate.v1',
      version: 1,
      storage: createJSONStorage(() => ({
        getItem: (k) => Storage.getItemSync(k),
        setItem: (k, v) => Storage.setItemSync(k, v),
        removeItem: (k) => Storage.removeItemSync(k),
      })),
      partialize: ({ settings, workplaces, templates, shifts, rotations, paychecks }) => ({
        settings, workplaces, templates, shifts, rotations, paychecks,
      }),
      // future schema changes: bump version and transform here
      migrate: (persisted) => persisted as DataState,
    },
  ),
);

export const newWorkplace = (p: Partial<Workplace> = {}): Workplace => ({
  id: uid(),
  name: 'My job',
  color: 'ember',
  hourlyRate: 15,
  payPeriod: { kind: 'biweekly', anchor: startOfWeek(todayYmd(), useStore.getState().settings.weekStartsOn) },
  rules: {},
  ...p,
});

export const blankShift = (p: Partial<Shift> & Pick<Shift, 'workplaceId' | 'date'>): Shift => ({
  id: uid(),
  start: '09:00',
  end: '17:00',
  breakMin: 0,
  color: 'ember',
  title: 'Shift',
  tz: deviceTz(),
  ...p,
});
