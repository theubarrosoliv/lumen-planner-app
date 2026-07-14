export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface Task {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or "—"
  title: string;
  tag: string;
  done: boolean;
  notes?: string;
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global taskReminderMinutesBefore for this task only. */
  notifyMinutesBefore?: number;
}

export type HabitFrequency = "daily" | "weekly" | "monthly";

export interface Habit {
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
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides both global habitReminderHour and habitStreakRiskHour for this habit only. */
  notifyHour?: number;
}

export interface Milestone {
  id: string;
  name: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global deadlineLeadDays for this milestone only. */
  notifyDaysBefore?: number;
}

export interface Goal {
  id: string;
  name: string;
  category: string;
  deadline: string; // free text or YYYY-MM-DD
  milestones: Milestone[];
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global deadlineLeadDays for this goal only. */
  notifyDaysBefore?: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global deadlineLeadDays for this project task only. */
  notifyDaysBefore?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "Não Iniciado" | "Planejamento" | "Em andamento" | "Concluído";
  deadline: string;
  tasks: ProjectTask[];
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global deadlineLeadDays for this project only. */
  notifyDaysBefore?: number;
}

export interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color: string; // bg-* class
  /** Per-item notification opt-out; absent/undefined counts as enabled. */
  notify?: boolean;
  /** Overrides the global dailyAgendaHour for this event's day-of reminder only. */
  notifyHour?: number;
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
  /** Minutes before a Task's scheduled time to send the "compromisso próximo" reminder. */
  taskReminderMinutesBefore: number;
  /** Local hour (0-23) for the daily agenda summary. */
  dailyAgendaHour: number;
  /** Local hour (0-23) for the pending-habit reminder. */
  habitReminderHour: number;
  /** Local hour (0-23) for the "streak at risk" late-day nudge. */
  habitStreakRiskHour: number;
  /** Days-before-deadline thresholds for goal/milestone/project/project-task reminders. */
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
