import { CheckCircle2, CalendarDays, Repeat, Target, type LucideIcon } from "lucide-react";

/** Shared "quick add" destinations — used by the Dashboard header button and
 * the bottom nav's center (+) button, so both always offer the same choices. */
export interface QuickAddItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const QUICK_ADD: QuickAddItem[] = [
  { label: "Tarefa", to: "/agenda", icon: CheckCircle2 },
  { label: "Evento", to: "/calendario", icon: CalendarDays },
  { label: "Hábito", to: "/habitos", icon: Repeat },
  { label: "Meta", to: "/metas", icon: Target },
];
