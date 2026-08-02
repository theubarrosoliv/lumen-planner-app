import { Habit, HabitFrequency } from "@/store/types";
import { WEEKDAY_OPTIONS } from "@/lib/date";

const pad = (n: number) => String(n).padStart(2, "0");

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function isoWeekKey(d: Date): string {
  // ISO week: week containing Thursday
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((x.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${x.getUTCFullYear()}-W${pad(week)}`;
}

/** ISO weekday: 1=Monday..7=Sunday. */
function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Monday (local midnight) of the ISO week containing `d`. */
function isoWeekMonday(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - (isoWeekday(m) - 1));
  return m;
}

/** Parses a "YYYY-MM-DD" key as a LOCAL date (not `new Date(str)`, which
 * treats a bare date string as UTC midnight — misreading it a day off in any
 * timezone west of UTC once its local getters are read back). */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Key for the "every_n_days" cycle containing `date`: the YYYY-MM-DD of that
 * cycle's own start day, counted in `intervalDays`-sized chunks from the
 * habit's `anchorDate`. Using the cycle's start date (rather than an
 * abstract index) keeps the key self-describing and stable even if
 * `intervalDays` is later edited (past cycles keep their original keys).
 *
 * `anchorDate` is deliberately a plain "YYYY-MM-DD" (set once at creation
 * from the CLIENT's own local calendar day — see habitsSlice.ts), not a
 * timestamp derived from `createdAt`. A UTC instant re-read through
 * `getFullYear()/getMonth()/getDate()` reflects whatever timezone is doing
 * the reading — the user's browser on the client, but plain UTC on the Deno
 * edge function server — so the "same" anchor would resolve to different
 * calendar days (and therefore different cycle boundaries) depending on
 * which side computed it. A bare date string sidesteps that entirely: both
 * sides parse it the same way, with no instant-to-local conversion involved.
 */
function cycleKey(anchorDate: string, intervalDays: number, date: Date): string {
  const anchorDay = parseDateKey(anchorDate);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSince = Math.round((day.getTime() - anchorDay.getTime()) / 86_400_000);
  const cycleIndex = Math.floor(daysSince / intervalDays);
  const cycleStart = new Date(anchorDay);
  cycleStart.setDate(cycleStart.getDate() + cycleIndex * intervalDays);
  return dayKey(cycleStart);
}

/** The minimum a caller needs to supply to compute period keys — every real
 * `Habit` satisfies this, but callers that only care about the three
 * calendar-uniform kinds (daily/weekly/monthly) can pass a bare literal. */
export interface HabitFreqLike {
  frequency: HabitFrequency;
  weekdays?: number[];
  intervalDays?: number;
  timesPerWeek?: number;
  /** Plain "YYYY-MM-DD" — the calendar day an "every_n_days" habit's cycle
   * is anchored to. Set once at creation (or when frequency is first
   * switched to "every_n_days"); see habitsSlice.ts. */
  anchorDate?: string;
}

/** True when `date` is a day this habit is expected to be acted on. Only
 * "weekdays" habits ever say no — every other kind is "due" at its own
 * granularity (a whole week/month/cycle, or any day for times_per_week). */
export function isDueOn(h: HabitFreqLike, date: Date): boolean {
  if (h.frequency === "weekdays") {
    const days = h.weekdays ?? [];
    return days.length === 0 || days.includes(isoWeekday(date));
  }
  return true;
}

export function periodKeyFor(h: HabitFreqLike, date: Date = new Date()): string {
  switch (h.frequency) {
    case "weekly":
      return isoWeekKey(date);
    case "monthly":
      return monthKey(date);
    case "every_n_days":
      return cycleKey(h.anchorDate ?? dayKey(date), Math.max(1, h.intervalDays ?? 1), date);
    default:
      // daily, weekdays, times_per_week — all completions keyed per calendar day
      return dayKey(date);
  }
}

export function currentPeriodKey(habit: Habit): string {
  return periodKeyFor(habit);
}

/** Returns the period key offset back by `n` periods from `from` (today by
 * default). For "weekdays", `n` counts DUE days only (non-due days are
 * skipped, never counted as a period of their own). */
export function periodKeyBack(h: HabitFreqLike, n: number, from: Date = new Date()): string {
  const freq = h.frequency ?? "daily";

  if (freq === "daily" || freq === "times_per_week") {
    const d = new Date(from);
    d.setDate(d.getDate() - n);
    return periodKeyFor(h, d);
  }
  if (freq === "weekly") {
    const d = new Date(from);
    d.setDate(d.getDate() - n * 7);
    return periodKeyFor(h, d);
  }
  if (freq === "monthly") {
    // Subtract via a month INDEX, not Date#setMonth(). setMonth rolls over
    // when the current day-of-month doesn't exist in the target month (e.g.
    // Mar 31 minus 1 month lands on Mar 3, since Feb has no 31st) — that
    // silently skipped a month and let a broken monthly streak read as
    // unbroken instead of resetting to 0. Using day=1 sidesteps this.
    const idx = from.getFullYear() * 12 + from.getMonth() - n;
    const y = Math.floor(idx / 12);
    const m = idx - y * 12;
    return periodKeyFor(h, new Date(y, m, 1));
  }
  if (freq === "every_n_days") {
    const interval = Math.max(1, h.intervalDays ?? 1);
    const d = new Date(from);
    d.setDate(d.getDate() - n * interval);
    return periodKeyFor(h, d);
  }

  // weekdays: n=0 is just "from"'s own day key (whether or not it's due —
  // mirrors every other kind's n=0 case); n>=1 walks back n DUE days.
  if (n === 0) return dayKey(from);
  const d = new Date(from);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (isDueOn(h, d)) remaining--;
  }
  return dayKey(d);
}

/** Last N period keys, oldest first. For "weekdays" these are the last N DUE
 * days; for "times_per_week" the last N individual calendar days (any of
 * which can be checked in). */
export function lastNPeriods(h: HabitFreqLike, n: number, from: Date = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(periodKeyBack(h, i, from));
  return out;
}

/** Completions within the ISO week starting `monday`. */
function countInWeek(completions: Record<string, boolean>, monday: Date): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    if (completions[dayKey(d)]) count++;
  }
  return count;
}

/** Streak counted backwards from current period. Current may be incomplete. */
export function streakOf(habit: Habit, now: Date = new Date()): number {
  if (habit.frequency === "times_per_week") return streakTimesPerWeek(habit, now);

  let streak = 0;
  const current = periodKeyFor(habit, now);
  let i = 0;
  // Allow current to be incomplete (and, for "weekdays", this also covers
  // "today just isn't a due day" — completions[current] is simply never set).
  if (!habit.completions[current]) i = 1;
  for (; ; i++) {
    const k = periodKeyBack(habit, i, now);
    if (habit.completions[k]) streak++;
    else break;
  }
  return streak;
}

function streakTimesPerWeek(habit: Habit, now: Date): number {
  const target = Math.max(1, habit.timesPerWeek ?? 3);
  const monday0 = isoWeekMonday(now);
  let streak = 0;
  let i = 0;
  if (countInWeek(habit.completions, monday0) < target) i = 1; // current week allowed in-progress
  for (; ; i++) {
    const m = new Date(monday0);
    m.setDate(m.getDate() - i * 7);
    if (countInWeek(habit.completions, m) >= target) streak++;
    else break;
  }
  return streak;
}

/** Total completions ever (counts all true marks across the whole record). */
export function totalCompletions(habit: Habit): number {
  return Object.values(habit.completions).filter(Boolean).length;
}

/**
 * For the history bar: which of `periods` (oldest→newest, as from
 * lastNPeriods) belong to the CURRENT unbroken streak. Mirrors streakOf's
 * walk-backward-from-now logic, but returns a mask instead of a count, so a
 * past gap visually clears everything before it — old completions before a
 * break no longer read as "still streaking" in the bar. The most recent
 * period is allowed to be incomplete (today/this week/month may not be done
 * yet) without breaking the chain, same as streakOf.
 */
export function activeStreakPeriods(habit: Habit, periods: string[], from: Date = new Date()): boolean[] {
  if (habit.frequency === "times_per_week") {
    // Cells here are individual days. A day lights up only if it's actually
    // completed AND its week is one of the trailing weeks that met the
    // target — so a stray check-in in an otherwise-missed week doesn't read
    // as "part of the streak".
    const target = Math.max(1, habit.timesPerWeek ?? 3);
    const monday0 = isoWeekMonday(from);
    const satisfiedMondays = new Set<string>();
    let i = 0;
    if (countInWeek(habit.completions, monday0) < target) i = 1;
    for (; ; i++) {
      const m = new Date(monday0);
      m.setDate(m.getDate() - i * 7);
      if (countInWeek(habit.completions, m) >= target) satisfiedMondays.add(dayKey(m));
      else break;
    }
    return periods.map((p) => {
      if (!habit.completions[p]) return false;
      const [y, mo, da] = p.split("-").map(Number);
      return satisfiedMondays.has(dayKey(isoWeekMonday(new Date(y, mo - 1, da))));
    });
  }

  const mask = new Array(periods.length).fill(false);
  let broken = false;
  for (let i = periods.length - 1; i >= 0; i--) {
    if (broken) continue;
    const isCurrent = i === periods.length - 1;
    if (habit.completions[periods[i]]) {
      mask[i] = true;
    } else if (!isCurrent) {
      broken = true;
    }
  }
  return mask;
}

/** How many check-ins this week so far, and the target — only meaningful
 * for "times_per_week" habits. */
export function weekProgress(habit: Habit, from: Date = new Date()): { count: number; target: number } {
  return {
    count: countInWeek(habit.completions, isoWeekMonday(from)),
    target: Math.max(1, habit.timesPerWeek ?? 3),
  };
}

/** Per-habit, fully-specific frequency description (e.g. "Ter, Qui, Dom",
 * "A cada 15 dias", "3x por semana") — richer than the generic FREQUENCY_LABEL. */
export function describeFrequency(h: HabitFreqLike): string {
  switch (h.frequency) {
    case "daily":
      return "Diário";
    case "weekly":
      return "Semanal";
    case "monthly":
      return "Mensal";
    case "every_n_days":
      return `A cada ${Math.max(1, h.intervalDays ?? 1)} dias`;
    case "times_per_week":
      return `${Math.max(1, h.timesPerWeek ?? 3)}x por semana`;
    case "weekdays": {
      const days = (h.weekdays ?? []).slice().sort((a, b) => a - b);
      const labelOf = (d: number) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label ?? "";
      return days.length ? days.map(labelOf).join(", ") : "Dias específicos";
    }
    default:
      return "Diário";
  }
}

export const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
  weekdays: "Dias específicos",
  every_n_days: "A cada N dias",
  times_per_week: "X vezes/semana",
};

export const FREQUENCY_UNIT: Record<HabitFrequency, string> = {
  daily: "dias",
  weekly: "semanas",
  monthly: "meses",
  weekdays: "dias",
  every_n_days: "ciclos",
  times_per_week: "semanas",
};
