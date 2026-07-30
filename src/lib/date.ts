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

/**
 * Advances a "YYYY-MM-DD" date by one recurrence period, for auto-generating
 * a recurring task's next occurrence. Monthly uses a month INDEX (not
 * Date#setMonth) to avoid day-of-month rollover near month-end — see
 * src/lib/habits.ts for the same bug fixed the same way for habit streaks —
 * and clamps to the target month's last day (e.g. Jan 31 → Feb 28/29).
 */
export function nextRecurrenceDate(
  dateStr: string,
  freq: "daily" | "weekly" | "monthly",
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (freq === "daily") return toDateKey(new Date(y, m - 1, d + 1));
  if (freq === "weekly") return toDateKey(new Date(y, m - 1, d + 7));

  const idx = y * 12 + (m - 1) + 1;
  const ny = Math.floor(idx / 12);
  const nm = idx - ny * 12;
  const lastDay = new Date(ny, nm + 1, 0).getDate();
  return toDateKey(new Date(ny, nm, Math.min(d, lastDay)));
}
