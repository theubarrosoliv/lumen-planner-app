import { Task } from "@/store/types";
import { nearestMatchingWeekday } from "@/lib/date";

const DAY_MS = 86400000;

/**
 * A Task only ever sits on one `date`, so recurrence "weekdays" with more
 * than one day chosen (e.g. "toda terça e sexta") can't be represented by a
 * single Task — saving just one meant only ONE of the chosen days ever had
 * an instance on the calendar at a time; the others only appeared one at a
 * time, after completing whichever was created first (see nextRecurrenceDate
 * in src/lib/date.ts, which only advances to the NEXT chosen day, not all of
 * them at once). Splits it into one independent single-day task per chosen
 * weekday instead — each snapped forward to the nearest matching date — so
 * every chosen day shows up right away and keeps recurring on its own.
 * A no-op (returns `[t]`) for every other recurrence, and even for
 * "weekdays" with a single day it still snaps `date` onto that weekday, in
 * case the form's date field was left on an unrelated day.
 */
export function splitWeekdayTask<T extends { recurrence?: string; weekdays?: number[]; date: string }>(
  t: T,
): T[] {
  if (t.recurrence !== "weekdays" || !t.weekdays || t.weekdays.length === 0) return [t];
  return t.weekdays
    .slice()
    .sort((a, b) => a - b)
    .map((day) => ({ ...t, weekdays: [day], date: nearestMatchingWeekday(t.date, day) }));
}

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
