import { TaskPriority } from "@/store/types";

/** Crimson/orange/green, reusing the app's existing destructive/warning/success
 * tokens so priority coloring stays on-palette instead of introducing new hues. */
export const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-success",
};

export const PRIORITY_BLOCK_STYLE: Record<TaskPriority, string> = {
  high: "border-destructive/50 bg-destructive/10",
  medium: "border-warning/50 bg-warning/10",
  low: "border-success/50 bg-success/10",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

/** Lower sorts first: Alta, Média, Baixa, sem prioridade. */
export const PRIORITY_ORDER: Record<TaskPriority | "none", number> = {
  high: 0,
  medium: 1,
  low: 2,
  none: 3,
};
