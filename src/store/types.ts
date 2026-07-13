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
}

export interface Milestone {
  id: string;
  name: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
}

export interface Goal {
  id: string;
  name: string;
  category: string;
  deadline: string; // free text or YYYY-MM-DD
  milestones: Milestone[];
}

export interface ProjectTask {
  id: string;
  title: string;
  done: boolean;
  deadline?: string; // YYYY-MM-DD
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "Planejamento" | "Em andamento" | "Concluído";
  deadline: string;
  tasks: ProjectTask[];
}

export interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  color: string; // bg-* class
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

export interface UserData {
  tasks: Task[];
  habits: Habit[];
  goals: Goal[];
  projects: Project[];
  events: CalEvent[];
  mindmaps: MindMap[];
}

export const emptyUserData = (): UserData => ({
  tasks: [],
  habits: [],
  goals: [],
  projects: [],
  events: [],
  mindmaps: [],
});
