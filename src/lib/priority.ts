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

/** Solid fill for the accent stripe down the left edge of a Cronograma block.
 * Full opacity on purpose: it's a few pixels wide, so anything translucent
 * reads as grey against the day lane behind it. */
export const PRIORITY_ACCENT: Record<TaskPriority, string> = {
  high: "bg-destructive",
  medium: "bg-warning",
  low: "bg-success",
};

/** Companion border for a block carrying PRIORITY_ACCENT — tints the outline
 * without washing out the (opaque) block background. */
export const PRIORITY_BORDER: Record<TaskPriority, string> = {
  high: "border-destructive/60",
  medium: "border-warning/60",
  low: "border-success/60",
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
