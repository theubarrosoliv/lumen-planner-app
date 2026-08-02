import { Task } from "@/store/types";
import { nearestMatchingWeekday, nextRecurrenceDate } from "@/lib/date";

const DAY_MS = 86400000;

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// How many future occurrences to pre-create for a brand-new recurring task,
// so e.g. "psicóloga toda segunda" already shows up on the calendar weeks
// ahead instead of only revealing next Monday once THIS Monday is checked
// off. Roughly 3 months for a weekly cadence; capped for every_n_days so a
// short interval (every 2 days) doesn't generate dozens of rows at once.
const WEEKDAY_HORIZON = 12;
const EVERY_N_DAYS_HORIZON_DAYS = 90;
const EVERY_N_DAYS_MAX_COUNT = 12;

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

type Recurring = {
  recurrence?: string;
  weekdays?: number[];
  intervalDays?: number;
  date: string;
  seriesId?: string;
};

/**
 * For a BRAND-NEW recurring task, pre-creates the next several occurrences
 * up front instead of just one — otherwise "weekdays"/"every_n_days"
 * recurrence only ever has a single instance in existence at a time (the
 * next one is created by toggleTask in tasksSlice.ts only once the current
 * one is completed), so a weekly appointment like "psicóloga toda segunda"
 * never showed up on the calendar for any Monday beyond the very next one.
 *
 * All occurrences of one lineage share a `seriesId` so toggleTask can tell
 * "the next occurrence already exists" from "spawn a fresh one" and avoid
 * creating duplicates — see the recurrence branch in toggleTask.
 *
 * Deliberately NOT applied to "daily"/"weekly"/"monthly" (unchanged,
 * one-at-a-time behavior — those read more like a recurring to-do you
 * check off than a standing appointment) or reused on the EDIT path (see
 * splitWeekdayTask above) — re-running this on every save of an existing
 * task would keep generating fresh batches of duplicates.
 */
export function materializeRecurringTask<T extends Recurring>(t: T): T[] {
  if (t.recurrence === "weekdays" && t.weekdays && t.weekdays.length > 0) {
    const out: T[] = [];
    for (const day of t.weekdays.slice().sort((a, b) => a - b)) {
      const seriesId = uid();
      let date = nearestMatchingWeekday(t.date, day);
      for (let i = 0; i < WEEKDAY_HORIZON; i++) {
        out.push({ ...t, weekdays: [day], date, seriesId });
        date = nextRecurrenceDate(date, "weekdays", { weekdays: [day] });
      }
    }
    return out;
  }

  if (t.recurrence === "every_n_days" && t.intervalDays && t.intervalDays >= 1) {
    const seriesId = uid();
    const count = Math.min(
      EVERY_N_DAYS_MAX_COUNT,
      Math.max(1, Math.ceil(EVERY_N_DAYS_HORIZON_DAYS / t.intervalDays)),
    );
    const out: T[] = [];
    let date = t.date;
    for (let i = 0; i < count; i++) {
      out.push({ ...t, date, seriesId });
      date = nextRecurrenceDate(date, "every_n_days", { intervalDays: t.intervalDays });
    }
    return out;
  }

  return [t];
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
