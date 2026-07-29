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
