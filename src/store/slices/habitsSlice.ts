import { StateCreator } from "zustand";
import { Habit, HabitFrequency } from "../types";
import { CoreState, mutate, uid } from "../core";

export interface HabitsSlice {
  addHabit: (name: string, frequency?: HabitFrequency, notify?: boolean) => void;
  updateHabit: (id: string, patch: Partial<Pick<Habit, "name" | "frequency" | "notify">>) => void;
  removeHabit: (id: string) => void;
  toggleHabitPeriod: (id: string, key: string) => void;
}

export const createHabitsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & HabitsSlice, [], [], HabitsSlice> => (set) => ({
  addHabit: persist((name: string, frequency: HabitFrequency = "daily", notify?: boolean) =>
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
            completions: {},
          },
        ],
      })),
    ),
  ),
  updateHabit: persist((id: string, patch: Partial<Pick<Habit, "name" | "frequency" | "notify">>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        habits: d.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)),
      })),
    ),
  ),
  removeHabit: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, habits: d.habits.filter((h) => h.id !== id) }))),
  ),
  toggleHabitPeriod: persist((id: string, key: string) =>
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
    ),
  ),
});
