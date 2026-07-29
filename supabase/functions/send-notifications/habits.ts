// Deno-local port of src/lib/habits.ts's period-key/streak logic. Can't be
// imported cross-runtime (Vite bundle vs Deno Edge Function), so this is an
// intentional duplicate — if src/lib/habits.ts's algorithm ever changes,
// mirror the change here too.

export type HabitFrequency = "daily" | "weekly" | "monthly";

export interface HabitLike {
  frequency: HabitFrequency;
  completions: Record<string, boolean>;
}

const pad = (n: number) => String(n).padStart(2, "0");

const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function isoWeekKey(d: Date): string {
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

export function periodKeyBack(freq: HabitFrequency, n: number, from: Date = new Date()): string {
  if (freq === "daily") {
    const d = new Date(from);
    d.setDate(d.getDate() - n);
    return periodKeyFor(freq, d);
  }
  if (freq === "weekly") {
    const d = new Date(from);
    d.setDate(d.getDate() - n * 7);
    return periodKeyFor(freq, d);
  }
  // Monthly: subtract via a month INDEX, not Date#setMonth() — see
  // src/lib/habits.ts for why (day-of-month rollover near month-end silently
  // skipped a month and let a broken streak read as unbroken).
  const idx = from.getFullYear() * 12 + from.getMonth() - n;
  const y = Math.floor(idx / 12);
  const m = idx - y * 12;
  return periodKeyFor(freq, new Date(y, m, 1));
}

export function streakOf(habit: HabitLike, now: Date = new Date()): number {
  const freq = habit.frequency ?? "daily";
  let streak = 0;
  const current = periodKeyFor(freq, now);
  let i = 0;
  if (!habit.completions[current]) i = 1;
  for (; ; i++) {
    const k = periodKeyBack(freq, i, now);
    if (habit.completions[k]) streak++;
    else break;
  }
  return streak;
}
