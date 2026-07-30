import { Task } from "@/store/types";

const DAY_MS = 86400000;

/**
 * Completed tasks are kept for a grace window (in case the user unmarks them
 * by mistake) then dropped for good — otherwise "Todas" in Agenda accumulates
 * every task ever finished. Legacy tasks marked done before `completedAt`
 * existed have no timestamp to judge by; treated as already past the window
 * so the existing backlog clears out too instead of lingering forever.
 */
export function pruneCompletedTasks(tasks: Task[], graceDays = 3, now: number = Date.now()): Task[] {
  return tasks.filter(
    (t) => !t.done || now - new Date(t.completedAt ?? 0).getTime() <= graceDays * DAY_MS,
  );
}
