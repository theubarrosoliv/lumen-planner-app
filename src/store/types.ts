export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

/** Free-form per-item notification lead time: N unit(s) before the item's due moment. */
export type NotifyLeadUnit = "minutes" | "hours" | "days" | "weeks";

/**
 * Per-item notification override, shared by every notifiable entity below.
 * `notify` absent/undefined counts as enabled (opt-out model, so existing
 * items aren't silently muted when this field ships). `notifyLeadValue`
 * absent means "use the category's global default" from NotificationPrefs;
 * when present, it's fully user-chosen (any number, any unit) and replaces
 * the global default entirely for that item.
 */
export interface NotifyOverride {
  notify?: boolean;
  notifyLeadValue?: number;
  notifyLeadUnit?: NotifyLeadUnit;
}

export type TaskPriority = "high" | "medium" | "low";

/**
 * "weekdays": repeats only on the chosen ISO weekdays (1=Mon..7=Sun) — covers
 * "toda terça", "toda terça e quinta", etc.
 * "every_n_days": repeats every N days from the last occurrence — covers
 * "de 15 em 15 dias".
 */
export type TaskRecurrence = "daily" | "weekly" | "monthly" | "weekdays" | "every_n_days";

export interface Task extends NotifyOverride {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or "—"
  title: string;
  /** @deprecated superseded by `tags`; kept so tasks saved before the
   * multi-tag change still read correctly (see src/lib/tags.ts). */
  tag?: string;
  tags?: string[];
  priority?: TaskPriority;
  /** When set, completing the task creates its next occurrence automatically. */
  recurrence?: TaskRecurrence;
  /** Required when `recurrence` is "weekdays": ISO weekdays (1=Mon..7=Sun) it repeats on. */
  weekdays?: number[];
  /** Required when `recurrence` is "every_n_days": the interval in days (>=2). */
  intervalDays?: number;
  /** Shared by every occurrence of the same recurring lineage (set when several
   * future occurrences are pre-created at once — see materializeRecurringTask
   * in src/lib/tasks.ts), so completing one can tell whether the next
   * occurrence already exists instead of creating a duplicate. Absent for
   * tasks created before this existed, and for "daily"/"weekly"/"monthly",
   * which still only ever have one live occurrence at a time. */
  seriesId?: string;
  /** Minutes; used to size this task's block in the Cronograma timeline. Absent = default block height. */
  duration?: number;
  done: boolean;
  /** ISO timestamp set when `done` flips to true; cleared when unmarked.
   * Drives the 3-day grace window before a completed task is auto-deleted
   * (see src/lib/tasks.ts) so "Todas" doesn't accumulate forever. */
  completedAt?: string;
  notes?: string;
}

/**
 * "weekdays": due only on the chosen ISO weekdays — other days don't count
 * against the streak. "every_n_days": one checkbox per N-day cycle, anchored
 * to the habit's `createdAt`. "times_per_week": any day counts, checked
 * against a per-week target instead of a fixed day.
 */
export type HabitFrequency = "daily" | "weekly" | "monthly" | "weekdays" | "every_n_days" | "times_per_week";

export interface Habit extends NotifyOverride {
  id: string;
  name: string;
  createdAt: string;
  frequency: HabitFrequency;
  /** Required when `frequency` is "weekdays": ISO weekdays (1=Mon..7=Sun) the habit is due. */
  weekdays?: number[];
  /** Required when `frequency` is "every_n_days": the cycle length in days (>=2). */
  intervalDays?: number;
  /** Required when `frequency` is "every_n_days": plain "YYYY-MM-DD" calendar
   * day the cycle is anchored to (the client's local day when this frequency
   * was set — see habitsSlice.ts). Deliberately NOT derived from `createdAt`:
   * that's a UTC timestamp, and re-reading its calendar date depends on
   * whichever timezone happens to be doing the reading (the user's browser
   * vs. the UTC edge-function server), which can disagree on what day it is. */
  anchorDate?: string;
  /** Required when `frequency` is "times_per_week": check-ins needed within the ISO week to count it as done. */
  timesPerWeek?: number;
  /**
   * Keyed by period:
   *  - daily / weekdays / times_per_week: YYYY-MM-DD (one entry per day)
   *  - weekly:                            YYYY-Www (ISO week)
   *  - monthly:                           YYYY-MM
   *  - every_n_days:                      YYYY-MM-DD of the cycle's start day
   * Past completions are preserved even when frequency changes.
   */
  completions: Record<string, boolean>;
}

export interface Milestone extends NotifyOverride {
  id: string;
  name: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
}

export interface Goal extends NotifyOverride {
  id: string;
  name: string;
  category: string;
  deadline: string; // free text or YYYY-MM-DD
  milestones: Milestone[];
}

export interface ProjectTask extends NotifyOverride {
  id: string;
  title: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
}

export interface Project extends NotifyOverride {
  id: string;
  name: string;
  description: string;
  status: "Não Iniciado" | "Planejamento" | "Em andamento" | "Concluído";
  deadline: string;
  tasks: ProjectTask[];
}

export interface CalEvent extends NotifyOverride {
  id: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM — optional; when set, the event (and its reminder) is anchored to this moment
  title: string;
  color: string; // bg-* class
  tags?: string[];
  /** Minutes; used to size this event's block in the Cronograma timeline. Absent = default block height. */
  duration?: number;
}

export interface MindNode {
  id: string;
  text: string;
  x: number;
  y: number;
  parentId?: string;
}

export interface MindEdge {
  id: string;
  from: string;
  to: string;
}

export interface MindMap {
  id: string;
  name: string;
  createdAt: string;
  nodes: MindNode[];
  edges: MindEdge[];
  viewport?: { x: number; y: number; zoom: number };
}

export interface NotificationCategoryPrefs {
  taskReminder: boolean;
  dailyAgenda: boolean;
  eventReminder: boolean;
  habitReminder: boolean;
  habitStreakRisk: boolean;
  goalDeadline: boolean;
  milestoneDeadline: boolean;
  projectDeadline: boolean;
  projectTaskDeadline: boolean;
}

export interface NotificationPrefs {
  enabled: boolean;
  /** IANA timezone name, e.g. "America/Sao_Paulo". Captured client-side on first use. */
  timezone?: string;
  categories: NotificationCategoryPrefs;
  /** Default minutes-before for tasks without their own per-item override. */
  taskReminderMinutesBefore: number;
  /** Local hour (0-23) for the daily agenda summary. */
  dailyAgendaHour: number;
  /** Local hour (0-23) for the pending-habit reminder (habits without their own override). */
  habitReminderHour: number;
  /** Local hour (0-23) for the "streak at risk" late-day nudge (habits without their own override). */
  habitStreakRiskHour: number;
  /** Days-before-deadline thresholds for goal/milestone/project/project-task reminders without their own override. */
  deadlineLeadDays: number[];
}

export const defaultNotificationPrefs = (): NotificationPrefs => ({
  enabled: false,
  categories: {
    taskReminder: true,
    dailyAgenda: true,
    eventReminder: true,
    habitReminder: true,
    habitStreakRisk: true,
    goalDeadline: true,
    milestoneDeadline: true,
    projectDeadline: true,
    projectTaskDeadline: true,
  },
  taskReminderMinutesBefore: 15,
  dailyAgendaHour: 8,
  habitReminderHour: 20,
  habitStreakRiskHour: 22,
  deadlineLeadDays: [3, 1],
});

export interface UserData {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  events: CalEvent[];
  mindmaps: MindMap[];
  notificationPrefs: NotificationPrefs;
}

export const emptyUserData = (): UserData => ({
  tasks: [],
  habits: [],
  goals: [],
  projects: [],
  events: [],
  mindmaps: [],
  notificationPrefs: defaultNotificationPrefs(),
});
