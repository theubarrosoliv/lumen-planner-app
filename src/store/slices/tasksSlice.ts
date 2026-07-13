import { StateCreator } from "zustand";
import { Task } from "../types";
import { CoreState, mutate, uid } from "../core";

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
): StateCreator<CoreState & TasksSlice, [], [], TasksSlice> => (set) => ({
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
  toggleTask: persist((id: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        tasks: d.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
      })),
    ),
  ),
  removeTask: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }))),
  ),
});
