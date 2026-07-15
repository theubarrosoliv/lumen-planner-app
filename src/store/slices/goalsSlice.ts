import { StateCreator } from "zustand";
import { Goal, Milestone } from "../types";
import { CoreState, mutate, uid } from "../core";
import { notifyLocal } from "@/lib/localNotify";

export interface GoalsSlice {
  addGoal: (
    g: Omit<Goal, "id" | "milestones"> & { milestones?: { name: string; deadline?: string }[] },
  ) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addMilestone: (goalId: string, name: string, deadline?: string) => void;
  updateMilestone: (goalId: string, milestoneId: string, patch: Partial<Milestone>) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  removeMilestone: (goalId: string, milestoneId: string) => void;
}

export const createGoalsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
): StateCreator<CoreState & GoalsSlice, [], [], GoalsSlice> => (set, get) => ({
  addGoal: persist(
    (g: Omit<Goal, "id" | "milestones"> & { milestones?: { name: string; deadline?: string }[] }) =>
      set((s) =>
        mutate(s, (d) => ({
          ...d,
          goals: [
            ...d.goals,
            {
              id: uid(),
              name: g.name,
              category: g.category,
              deadline: g.deadline,
              notify: g.notify,
              notifyLeadValue: g.notifyLeadValue,
              notifyLeadUnit: g.notifyLeadUnit,
              milestones: (g.milestones ?? []).map<Milestone>((m) => ({
                id: uid(),
                name: m.name,
                deadline: m.deadline,
                done: false,
              })),
            },
          ],
        })),
      ),
  ),
  updateGoal: persist((id: string, patch: Partial<Goal>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)),
      })),
    ),
  ),
  removeGoal: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }))),
  ),
  addMilestone: persist((goalId: string, name: string, deadline?: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        goals: d.goals.map((g) =>
          g.id === goalId
            ? { ...g, milestones: [...g.milestones, { id: uid(), name, deadline, done: false }] }
            : g,
        ),
      })),
    ),
  ),
  updateMilestone: persist((goalId: string, milestoneId: string, patch: Partial<Milestone>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        goals: d.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                milestones: g.milestones.map((m) =>
                  m.id === milestoneId ? { ...m, ...patch } : m,
                ),
              }
            : g,
        ),
      })),
    ),
  ),
  toggleMilestone: persist((goalId: string, milestoneId: string) => {
    const userId = get().currentUserId;
    const before = userId ? get().data[userId]?.goals.find((g) => g.id === goalId) : undefined;

    set((s) =>
      mutate(s, (d) => ({
        ...d,
        goals: d.goals.map((g) =>
          g.id === goalId
            ? {
                ...g,
                milestones: g.milestones.map((m) =>
                  m.id === milestoneId ? { ...m, done: !m.done } : m,
                ),
              }
            : g,
        ),
      })),
    );

    if (before && before.milestones.length > 0 && !before.milestones.every((m) => m.done)) {
      const after = userId ? get().data[userId]?.goals.find((g) => g.id === goalId) : undefined;
      if (after && after.milestones.every((m) => m.done)) {
        notifyLocal("🎉 Meta concluída", after.name);
      }
    }
  }),
  removeMilestone: persist((goalId: string, milestoneId: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        goals: d.goals.map((g) =>
          g.id === goalId
            ? { ...g, milestones: g.milestones.filter((m) => m.id !== milestoneId) }
            : g,
        ),
      })),
    ),
  ),
});
