import { StateCreator } from "zustand";
import { Project, ProjectTask } from "../types";
import { CoreState, mutate, uid } from "../core";
import { notifyLocal } from "@/lib/localNotify";

export interface ProjectsSlice {
  addProject: (p: Omit<Project, "id" | "tasks">) => void;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  addProjectTask: (projectId: string, title: string, deadline?: string) => void;
  updateProjectTask: (projectId: string, taskId: string, patch: Partial<ProjectTask>) => void;
  toggleProjectTask: (projectId: string, taskId: string) => void;
  removeProjectTask: (projectId: string, taskId: string) => void;
}

export const createProjectsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & ProjectsSlice, [], [], ProjectsSlice> => (set, get) => ({
  addProject: persist((p: Omit<Project, "id" | "tasks">) =>
    set((s) =>
      mutate(s, (d) => ({ ...d, projects: [...d.projects, { ...p, id: uid(), tasks: [] }] })),
    ),
  ),
  updateProject: persist((id: string, patch: Partial<Project>) => {
    const userId = get().currentUserId;
    const before = userId ? get().data[userId]?.projects.find((p) => p.id === id) : undefined;

    set((s) =>
      mutate(s, (d) => ({
        ...d,
        projects: d.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      })),
    );

    if (before && before.status !== "Concluído" && patch.status === "Concluído") {
      notifyLocal("🎉 Projeto concluído", before.name);
    }
  }),
  removeProject: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, projects: d.projects.filter((p) => p.id !== id) }))),
  ),
  addProjectTask: persist((projectId: string, title: string, deadline?: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === projectId
            ? { ...p, tasks: [...p.tasks, { id: uid(), title, deadline, done: false } as ProjectTask] }
            : p,
        ),
      })),
    ),
  ),
  updateProjectTask: persist(
    (projectId: string, taskId: string, patch: Partial<ProjectTask>) =>
      set((s) =>
        mutate(s, (d) => ({
          ...d,
          projects: d.projects.map((p) =>
            p.id === projectId
              ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }
              : p,
          ),
        })),
      ),
  ),
  toggleProjectTask: persist((projectId: string, taskId: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === projectId
            ? { ...p, tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)) }
            : p,
        ),
      })),
    ),
  ),
  removeProjectTask: persist((projectId: string, taskId: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p,
        ),
      })),
    ),
  ),
});
