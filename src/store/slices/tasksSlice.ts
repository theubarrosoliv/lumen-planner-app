import { StateCreator } from "zustand";
import { Task } from "../types";
import { CoreState, mutate, uid } from "../core";
import { notifyLocal } from "@/lib/localNotify";
import { nextRecurrenceDate } from "@/lib/date";

export interface TasksSlice {
  addTask: (t: Omit<Task, "id" | "done">) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
}

/** Same pattern used by every domain slice: mutate the in-memory state, then
 * let the caller (useAppStore) persist to localStorage + debounce a cloud save. */
export const createTasksSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & TasksSlice, [], [], TasksSlice> => (set, get) => ({
  addTask: persist((t: Omit<Task, "id" | "done">) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        tasks: [...d.tasks, { ...t, id: uid(), done: false }],
      })),
    ),
  ),
  updateTask: persist((id: string, patch: Partial<Task>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      })),
    ),
  ),
  toggleTask: persist((id: string) => {
    const userId = get().currentUserId;
    const before = userId ? get().data[userId]?.tasks.find((t) => t.id === id) : undefined;

    set((s) =>
      mutate(s, (d) => ({
        ...d,
        tasks: d.tasks.map((t) => {
          if (t.id !== id) return t;
          const done = !t.done;
          return { ...t, done, completedAt: done ? new Date().toISOString() : undefined };
        }),
      })),
    );

    if (before && !before.done) {
      notifyLocal("🎉 Tarefa concluída", before.title);

      if (before.recurrence) {
        const { id: _id, done: _done, ...rest } = before;
        const nextDate = nextRecurrenceDate(before.date, before.recurrence, {
          weekdays: before.weekdays,
          intervalDays: before.intervalDays,
        });
        // If this occurrence belongs to a batch that already has a future
        // occurrence pre-created at nextDate (see materializeRecurringTask in
        // src/lib/tasks.ts), don't spawn a duplicate — only top up the series
        // once its horizon actually runs out.
        const alreadyExists =
          !!before.seriesId &&
          !!userId &&
          get().data[userId]?.tasks.some((t) => t.seriesId === before.seriesId && t.date === nextDate);
        if (!alreadyExists) {
          get().addTask({ ...rest, date: nextDate });
        }
      }
    }
  }),
  removeTask: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))),
  ),
});
