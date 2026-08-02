// Deno-local port of src/lib/habits.ts's period-key/streak logic. Can't be
// imported cross-runtime (Vite bundle vs Deno Edge Function), so this is an
// intentional duplicate — if src/lib/habits.ts's algorithm ever changes,
// mirror the change here too.

export type HabitFrequency = "daily" | "weekly" | "monthly" | "weekdays" | "every_n_days" | "times_per_week";

export interface HabitLike {
  frequency: HabitFrequency;
  weekdays?: number[];
  intervalDays?: number;
  timesPerWeek?: number;
  /** Plain "YYYY-MM-DD" — see the matching doc comment in src/lib/habits.ts
   * for why this is NOT derived from createdAt (a UTC timestamp would read
   * back as a different calendar day here, on the UTC server, than on the
   * user's own browser). */
  anchorDate?: string;
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

/** ISO weekday: 1=Monday..7=Sunday. */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

/** Monday (local midnight) of the ISO week containing `d`. */
function isoWeekMonday(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - (isoWeekday(m) - 1));
  return m;
}

/** Parses a "YYYY-MM-DD" key as a LOCAL date — `new Date(str)` would parse a
 * bare date string as UTC midnight, misreading it a day off once its local
 * getters are read back (this server runs in UTC, so this matters). */
function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function cycleKey(anchorDate: string, intervalDays: number, date: Date): string {
  const anchorDay = parseDateKey(anchorDate);
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSince = Math.round((day.getTime() - anchorDay.getTime()) / 86_400_000);
  const cycleIndex = Math.floor(daysSince / intervalDays);
  const cycleStart = new Date(anchorDay);
  cycleStart.setDate(cycleStart.getDate() + cycleIndex * intervalDays);
  return dayKey(cycleStart);
}

/** True when `date` is a day this habit is expected to be acted on. Only
 * "weekdays" habits ever say no. */
export function isDueOn(h: HabitLike, date: Date): boolean {
  if (h.frequency === "weekdays") {
    const days = h.weekdays ?? [];
    return days.length === 0 || days.includes(isoWeekday(date));
  }
  return true;
}

export function periodKeyFor(h: HabitLike, date: Date = new Date()): string {
  switch (h.frequency) {
    case "weekly":
      return isoWeekKey(date);
    case "monthly":
      return monthKey(date);
    case "every_n_days":
      return cycleKey(h.anchorDate ?? dayKey(date), Math.max(1, h.intervalDays ?? 1), date);
    default:
      return dayKey(date);
  }
}

export function periodKeyBack(h: HabitLike, n: number, from: Date = new Date()): string {
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
    // Subtract via a month INDEX, not Date#setMonth() — see src/lib/habits.ts
    // for why (day-of-month rollover near month-end silently skipped a
    // month and let a broken streak read as unbroken).
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

  // weekdays: n=0 is just "from"'s own day key; n>=1 walks back n DUE days.
  if (n === 0) return dayKey(from);
  const d = new Date(from);
  let remaining = n;
  while (remaining > 0) {
    d.setDate(d.getDate() - 1);
    if (isDueOn(h, d)) remaining--;
  }
  return dayKey(d);
}

function countInWeek(completions: Record<string, boolean>, monday: Date): number {
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    if (completions[dayKey(d)]) count++;
  }
  return count;
}

export function streakOf(habit: HabitLike, now: Date = new Date()): number {
  if (habit.frequency === "times_per_week") return streakTimesPerWeek(habit, now);

  let streak = 0;
  const current = periodKeyFor(habit, now);
  let i = 0;
  if (!habit.completions[current]) i = 1;
  for (; ; i++) {
    const k = periodKeyBack(habit, i, now);
    if (habit.completions[k]) streak++;
    else break;
  }
  return streak;
}

function streakTimesPerWeek(habit: HabitLike, now: Date): number {
  const target = Math.max(1, habit.timesPerWeek ?? 3);
  const monday0 = isoWeekMonday(now);
  let streak = 0;
  let i = 0;
  if (countInWeek(habit.completions, monday0) < target) i = 1;
  for (; ; i++) {
    const m = new Date(monday0);
    m.setDate(m.getDate() - i * 7);
    if (countInWeek(habit.completions, m) >= target) streak++;
    else break;
  }
  return streak;
}

/** How many check-ins this ISO week so far, and the target — only
 * meaningful for "times_per_week" habits. */
export function weekProgress(habit: HabitLike, from: Date = new Date()): { count: number; target: number } {
  return {
    count: countInWeek(habit.completions, isoWeekMonday(from)),
    target: Math.max(1, habit.timesPerWeek ?? 3),
  };
}

/** End of the CURRENT period containing `now` — the moment its window to
 * be completed closes. Used to compute lead-time notification windows. */
export function periodEnd(h: HabitLike, now: Date): Date {
  if (h.frequency === "weekly" || h.frequency === "times_per_week") {
    const isoDay = isoWeekday(now);
    const daysUntilNextMonday = 8 - isoDay;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday, 0, 0, 0);
  }
  if (h.frequency === "monthly") {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  }
  if (h.frequency === "every_n_days") {
    const interval = Math.max(1, h.intervalDays ?? 1);
    const anchorDay = parseDateKey(h.anchorDate ?? dayKey(now));
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysSince = Math.round((today.getTime() - anchorDay.getTime()) / 86_400_000);
    const cycleIndex = Math.floor(daysSince / interval);
    const cycleEnd = new Date(anchorDay);
    cycleEnd.setDate(cycleEnd.getDate() + (cycleIndex + 1) * interval);
    return cycleEnd;
  }
  // daily and weekdays: each due day is its own period, ending at midnight.
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
}
