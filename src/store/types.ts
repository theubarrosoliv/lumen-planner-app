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

export type TaskRecurrence = "daily" | "weekly" | "monthly";

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
  done: boolean;
  notes?: string;
}

export type HabitFrequency = "daily" | "weekly" | "monthly";

export interface Habit extends NotifyOverride {
  id: string;
  name: string;
  createdAt: string;
  frequency: HabitFrequency;
  /**
   * Keyed by period:
   *  - daily:   YYYY-MM-DD
   *  - weekly:  YYYY-Www (ISO week)
   *  - monthly: YYYY-MM
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
