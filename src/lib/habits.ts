import { Habit, HabitFrequency } from "@/store/types";

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

export function periodKeyFor(freq: HabitFrequency, date: Date = new Date()): string {
  if (freq === "weekly") return isoWeekKey(date);
  if (freq === "monthly") return monthKey(date);
  return dayKey(date);
}

export function currentPeriodKey(habit: Habit): string {
  return periodKeyFor(habit.frequency ?? "daily");
}

/** Returns the period key offset back by `n` periods from today. */
export function periodKeyBack(freq: HabitFrequency, n: number): string {
  const d = new Date();
  if (freq === "daily") {
    d.setDate(d.getDate() - n);
    return periodKeyFor(freq, d);
  }
  if (freq === "weekly") {
    d.setDate(d.getDate() - n * 7);
    return periodKeyFor(freq, d);
  }
  // Monthly: subtract via a month INDEX, not Date#setMonth(). setMonth rolls
  // over when the current day-of-month doesn't exist in the target month
  // (e.g. Mar 31 minus 1 month lands on Mar 3, since Feb has no 31st) — that
  // silently skipped a month and let a broken monthly streak read as unbroken
  // instead of resetting to 0. Using day=1 sidesteps day-of-month entirely.
  const idx = d.getFullYear() * 12 + d.getMonth() - n;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12;
  return periodKeyFor(freq, new Date(y, m, 1));
}

/** Last N period keys, oldest first. */
export function lastNPeriods(freq: HabitFrequency, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(periodKeyBack(freq, i));
  return out;
}

/** Streak counted backwards from current period. Current may be incomplete. */
export function streakOf(habit: Habit): number {
  const freq = habit.frequency ?? "daily";
  let streak = 0;
  const current = periodKeyFor(freq);
  let i = 0;
  // Allow current to be incomplete
  if (!habit.completions[current]) i = 1;
  for (; ; i++) {
    const k = periodKeyBack(freq, i);
    if (habit.completions[k]) streak++;
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
export function activeStreakPeriods(habit: Habit, periods: string[]): boolean[] {
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

export const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export const FREQUENCY_UNIT: Record<HabitFrequency, string> = {
  daily: "dias",
  weekly: "semanas",
  monthly: "meses",
};
