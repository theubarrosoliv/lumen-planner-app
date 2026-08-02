/**
 * Single source of truth for showing a deadline to the user. Deadlines are
 * stored either as an ISO "YYYY-MM-DD" date or as free text (e.g. "Sem prazo",
 * "próximo trimestre"). This keeps the rendering identical everywhere —
 * Dashboard, Metas, Projetos — instead of each screen formatting (or not)
 * on its own.
 */
export function formatDeadline(deadline?: string): string {
  if (!deadline || deadline === "—") return "Sem prazo";
  if (/^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
    const [y, m, d] = deadline.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return deadline;
}

/** Capitalizes the first letter of each word — for display of user-entered
 * names stored in lowercase (e.g. "matheus barros" → "Matheus Barros"). */
export function capitalizeWords(value: string): string {
  return value.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

const pad = (n: number) => String(n).padStart(2, "0");
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** ISO weekday: 1=Monday..7=Sunday (JS's `Date#getDay()` is 0=Sunday..6=Saturday). */
export function isoWeekday(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 7 : js;
}

const WEEKDAY_ABBR = ["", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
/** ISO weekday options (1=Mon..7=Sun) for weekday-picker UIs, shared by task
 * recurrence and habit frequency editors. */
export const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: WEEKDAY_ABBR[d] }));

/** Nearest date on/after `dateStr` (YYYY-MM-DD) whose ISO weekday is `weekday`. */
export function nearestMatchingWeekday(dateStr: string, weekday: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  for (let step = 0; step <= 6; step++) {
    const candidate = new Date(y, m - 1, d + step);
    if (isoWeekday(candidate) === weekday) return toDateKey(candidate);
  }
  return dateStr;
}

/**
 * Advances a "YYYY-MM-DD" date by one recurrence period, for auto-generating
 * a recurring task's next occurrence. Monthly uses a month INDEX (not
 * Date#setMonth) to avoid day-of-month rollover near month-end — see
 * src/lib/habits.ts for the same bug fixed the same way for habit streaks —
 * and clamps to the target month's last day (e.g. Jan 31 → Feb 28/29).
 */
export function nextRecurrenceDate(
  dateStr: string,
  freq: "daily" | "weekly" | "monthly" | "weekdays" | "every_n_days",
  opts?: { weekdays?: number[]; intervalDays?: number },
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (freq === "daily") return toDateKey(new Date(y, m - 1, d + 1));
  if (freq === "weekly") return toDateKey(new Date(y, m - 1, d + 7));

  if (freq === "every_n_days") {
    const n = Math.max(1, opts?.intervalDays ?? 1);
    return toDateKey(new Date(y, m - 1, d + n));
  }

  if (freq === "weekdays") {
    const days = opts?.weekdays ?? [];
    // Scan forward up to a week for the next matching weekday; falls back to
    // +7 days if no weekday was actually chosen (shouldn't happen — the UI
    // requires at least one — but keeps this total instead of stalling).
    for (let step = 1; step <= 7; step++) {
      const candidate = new Date(y, m - 1, d + step);
      if (days.includes(isoWeekday(candidate))) return toDateKey(candidate);
    }
    return toDateKey(new Date(y, m - 1, d + 7));
  }

  const idx = y * 12 + (m - 1) + 1;
  const ny = Math.floor(idx / 12);
  const nm = idx - ny * 12;
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  return toDateKey(new Date(ny, nm, Math.min(d, lastDay)));
}

/** Human-readable description of a task's recurrence, for the "repeats"
 * badge tooltip — e.g. "Repete: Ter, Qui" or "Repete a cada 15 dias". */
export function describeRecurrence(t: {
  recurrence?: "daily" | "weekly" | "monthly" | "weekdays" | "every_n_days";
  weekdays?: number[];
  intervalDays?: number;
}): string {
  switch (t.recurrence) {
    case "daily":
      return "Repete diariamente";
    case "weekly":
      return "Repete semanalmente";
    case "monthly":
      return "Repete mensalmente";
    case "every_n_days":
      return `Repete a cada ${Math.max(1, t.intervalDays ?? 1)} dias`;
    case "weekdays": {
      const days = (t.weekdays ?? []).slice().sort((a, b) => a - b);
      const labelOf = (d: number) => WEEKDAY_OPTIONS.find((o) => o.value === d)?.label ?? "";
      return days.length ? `Repete: ${days.map(labelOf).join(", ")}` : "Repete em dias específicos";
    }
    default:
      return "";
  }
}
