import { StateCreator } from "zustand";
import { DayPeriod, Habit, HabitFrequency, NotifyLeadUnit } from "../types";
import { CoreState, mutate, uid } from "../core";
import { notifyLocal } from "@/lib/localNotify";

const pad = (n: number) => String(n).padStart(2, "0");
/** Local calendar day (not UTC — see the anchorDate doc comment on Habit in
 * store/types.ts for why this matters for "every_n_days" habits). */
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export interface HabitsSlice {
  addHabit: (
    name: string,
    frequency?: HabitFrequency,
    notify?: boolean,
    notifyLeadValue?: number,
    notifyLeadUnit?: NotifyLeadUnit,
    weekdays?: number[],
    intervalDays?: number,
    timesPerWeek?: number,
    dayPeriod?: DayPeriod,
  ) => void;
  updateHabit: (
    id: string,
    patch: Partial<
      Pick<
        Habit,
        | "name"
        | "frequency"
        | "notify"
        | "notifyLeadValue"
        | "notifyLeadUnit"
        | "weekdays"
        | "intervalDays"
        | "timesPerWeek"
        | "dayPeriod"
      >
    >,
  ) => void;
  removeHabit: (id: string) => void;
  toggleHabitPeriod: (id: string, key: string) => void;
}

export const createHabitsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & HabitsSlice, [], [], HabitsSlice> => (set, get) => ({
  addHabit: persist(
    (
      name: string,
      frequency: HabitFrequency = "daily",
      notify?: boolean,
      notifyLeadValue?: number,
      notifyLeadUnit?: NotifyLeadUnit,
      weekdays?: number[],
      intervalDays?: number,
      timesPerWeek?: number,
      dayPeriod?: DayPeriod,
    ) =>
      set((s) =>
        mutate(s, (d) => ({
          ...d,
          habits: [
            ...d.habits,
            {
              id: uid(),
              name: name.trim(),
              createdAt: new Date().toISOString(),
              frequency,
              notify,
              notifyLeadValue,
              notifyLeadUnit,
              weekdays,
              intervalDays,
              timesPerWeek,
              dayPeriod,
              anchorDate: frequency === "every_n_days" ? localDayKey(new Date()) : undefined,
              completions: {},
            },
          ],
        })),
      ),
  ),
  updateHabit: persist(
    (
      id: string,
      patch: Partial<
        Pick<
          Habit,
          | "name"
          | "frequency"
          | "notify"
          | "notifyLeadValue"
          | "notifyLeadUnit"
          | "weekdays"
          | "intervalDays"
          | "timesPerWeek"
        >
      >,
    ) =>
      set((s) =>
        mutate(s, (d) => ({
          ...d,
          habits: d.habits.map((h) => {
            if (h.id !== id) return h;
            const next: Habit = { ...h, ...patch };
            // First time this habit becomes "every_n_days", anchor its cycle
            // to today — never overwrite an anchor that already exists (that
            // would silently shift every past cycle's boundary).
            if (next.frequency === "every_n_days" && !next.anchorDate) {
              next.anchorDate = localDayKey(new Date());
            }
            return next;
          }),
        })),
      ),
  ),
  removeHabit: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }))),
  ),
  toggleHabitPeriod: persist((id: string, key: string) => {
    const userId = get().currentUserId;
    const habit = userId ? get().data[userId]?.habits.find((h) => h.id === id) : undefined;
    const wasCompleted = !!habit?.completions[key];

    set((s) =>
      mutate(s, (d) => ({
        ...d,
        habits: d.habits.map((h) => {
          if (h.id !== id) return h;
          const c = { ...h.completions };
          if (c[key]) delete c[key];
          else c[key] = true;
          return { ...h, completions: c };
        }),
      })),
    );

    if (habit && !wasCompleted) {
      notifyLocal("🎉 Hábito concluído", habit.name);
    }
  }),
});
