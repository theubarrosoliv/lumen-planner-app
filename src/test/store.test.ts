import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", async () => {
  const mod = await import("./mocks/supabase");
  return { supabase: mod.supabase };
});

// Import after the mock is registered so useAppStore picks up the fake client.
const { useAppStore } = await import("@/store/useAppStore");

const TEST_USER_ID = "test-user-1";

function loginTestUser() {
  useAppStore.setState({
    currentUserId: TEST_USER_ID,
    users: [{ id: TEST_USER_ID, name: "Test", email: "test@example.com", createdAt: new Date().toISOString() }],
    data: { [TEST_USER_ID]: { tasks: [], habits: [], goals: [], projects: [], events: [], mindmaps: [] } },
    hydrated: true,
  });
}

beforeEach(() => {
  localStorage.clear();
  loginTestUser();
});

describe("tasksSlice", () => {
  it("adds a task as not done", () => {
    useAppStore.getState().addTask({ date: "2026-07-10", time: "09:00", title: "Escrever testes", tag: "dev" });
    const tasks = useAppStore.getState().data[TEST_USER_ID].tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "Escrever testes", done: false });
    expect(tasks[0].id).toBeTruthy();
  });

  it("toggles a task's done state", () => {
    useAppStore.getState().addTask({ date: "2026-07-10", time: "09:00", title: "X", tag: "dev" });
    const id = useAppStore.getState().data[TEST_USER_ID].tasks[0].id;
    useAppStore.getState().toggleTask(id);
    expect(useAppStore.getState().data[TEST_USER_ID].tasks[0].done).toBe(true);
    useAppStore.getState().toggleTask(id);
    expect(useAppStore.getState().data[TEST_USER_ID].tasks[0].done).toBe(false);
  });

  it("removes a task", () => {
    useAppStore.getState().addTask({ date: "2026-07-10", time: "09:00", title: "X", tag: "dev" });
    const id = useAppStore.getState().data[TEST_USER_ID].tasks[0].id;
    useAppStore.getState().removeTask(id);
    expect(useAppStore.getState().data[TEST_USER_ID].tasks).toHaveLength(0);
  });

  it("is a no-op when nobody is logged in", () => {
    useAppStore.setState({ currentUserId: null });
    useAppStore.getState().addTask({ date: "2026-07-10", time: "09:00", title: "X", tag: "dev" });
    // no user bucket should have been created
    expect(useAppStore.getState().data[TEST_USER_ID].tasks).toHaveLength(0);
  });
});

describe("habitsSlice", () => {
  it("adds a habit with default daily frequency", () => {
    useAppStore.getState().addHabit("Meditar");
    const habits = useAppStore.getState().data[TEST_USER_ID].habits;
    expect(habits[0]).toMatchObject({ name: "Meditar", frequency: "daily", completions: {} });
  });

  it("toggles a period completion on and off", () => {
    useAppStore.getState().addHabit("Ler");
    const id = useAppStore.getState().data[TEST_USER_ID].habits[0].id;
    useAppStore.getState().toggleHabitPeriod(id, "2026-07-10");
    expect(useAppStore.getState().data[TEST_USER_ID].habits[0].completions["2026-07-10"]).toBe(true);
    useAppStore.getState().toggleHabitPeriod(id, "2026-07-10");
    expect(useAppStore.getState().data[TEST_USER_ID].habits[0].completions["2026-07-10"]).toBeUndefined();
  });

  it("preserves past completions when frequency changes", () => {
    useAppStore.getState().addHabit("Correr", "daily");
    const id = useAppStore.getState().data[TEST_USER_ID].habits[0].id;
    useAppStore.getState().toggleHabitPeriod(id, "2026-07-10");
    useAppStore.getState().updateHabit(id, { frequency: "weekly" });
    const habit = useAppStore.getState().data[TEST_USER_ID].habits[0];
    expect(habit.frequency).toBe("weekly");
    expect(habit.completions["2026-07-10"]).toBe(true);
  });
});

describe("goalsSlice", () => {
  it("adds a goal with milestones", () => {
    useAppStore.getState().addGoal({
      name: "Aprender TypeScript",
      category: "Carreira",
      deadline: "2026-12-31",
      milestones: [{ name: "Terminar curso básico" }],
    });
    const goal = useAppStore.getState().data[TEST_USER_ID].goals[0];
    expect(goal.milestones).toHaveLength(1);
    expect(goal.milestones[0].done).toBe(false);
  });

  it("toggles a milestone independently of others", () => {
    useAppStore.getState().addGoal({ name: "G", category: "C", deadline: "2026-12-31", milestones: [] });
    const goalId = useAppStore.getState().data[TEST_USER_ID].goals[0].id;
    useAppStore.getState().addMilestone(goalId, "M1");
    useAppStore.getState().addMilestone(goalId, "M2");
    const [m1, m2] = useAppStore.getState().data[TEST_USER_ID].goals[0].milestones;
    useAppStore.getState().toggleMilestone(goalId, m1.id);
    const goal = useAppStore.getState().data[TEST_USER_ID].goals[0];
    expect(goal.milestones.find((m) => m.id === m1.id)?.done).toBe(true);
    expect(goal.milestones.find((m) => m.id === m2.id)?.done).toBe(false);
  });
});

describe("mindmapsSlice", () => {
  it("creates a mindmap with a root node", () => {
    const id = useAppStore.getState().addMindmap("Ideias do produto");
    const map = useAppStore.getState().data[TEST_USER_ID].mindmaps.find((m) => m.id === id);
    expect(map).toBeTruthy();
    expect(map!.nodes).toHaveLength(1);
  });

  it("duplicates a mindmap with fresh node/edge ids", () => {
    const id = useAppStore.getState().addMindmap("Original");
    const newId = useAppStore.getState().duplicateMindmap(id);
    expect(newId).toBeTruthy();
    expect(newId).not.toBe(id);
    const original = useAppStore.getState().data[TEST_USER_ID].mindmaps.find((m) => m.id === id)!;
    const copy = useAppStore.getState().data[TEST_USER_ID].mindmaps.find((m) => m.id === newId)!;
    expect(copy.nodes[0].id).not.toBe(original.nodes[0].id);
    expect(copy.name).toContain("cópia");
  });

  it("returns null when duplicating a mindmap that doesn't exist", () => {
    const newId = useAppStore.getState().duplicateMindmap("does-not-exist");
    expect(newId).toBeNull();
  });
});
