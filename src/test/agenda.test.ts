import { describe, expect, it } from "vitest";
import { pruneCompletedTasks, splitWeekdayTask } from "@/lib/tasks";
import { buildAgendaItems, inAgendaFilter, sortAgendaItems, AgendaItem } from "@/lib/agenda";
import { emptyUserData, Task } from "@/store/types";

const DAY_MS = 86400000;

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    date: "2026-07-10",
    time: "—",
    title: "Task",
    done: false,
    ...overrides,
  };
}

describe("pruneCompletedTasks", () => {
  it("keeps tasks that aren't done", () => {
    const tasks = [makeTask({ done: false })];
    expect(pruneCompletedTasks(tasks)).toHaveLength(1);
  });

  it("keeps a done task still inside the grace window", () => {
    const now = Date.parse("2026-07-10T12:00:00Z");
    const tasks = [makeTask({ done: true, completedAt: new Date(now - DAY_MS).toISOString() })];
    expect(pruneCompletedTasks(tasks, 3, now)).toHaveLength(1);
  });

  it("drops a done task once past the grace window", () => {
    const now = Date.parse("2026-07-10T12:00:00Z");
    const tasks = [makeTask({ done: true, completedAt: new Date(now - 4 * DAY_MS).toISOString() })];
    expect(pruneCompletedTasks(tasks, 3, now)).toHaveLength(0);
  });

  it("drops legacy done tasks with no completedAt (treated as already overdue)", () => {
    const tasks = [makeTask({ done: true, completedAt: undefined })];
    expect(pruneCompletedTasks(tasks)).toHaveLength(0);
  });
});

// 2026-07-06 is a Monday (verified: Mon 07-06, Tue 07-07, ..., Fri 07-10).
describe("splitWeekdayTask", () => {
  it("passes non-weekdays tasks through untouched", () => {
    const t = makeTask({ recurrence: "daily" });
    expect(splitWeekdayTask(t)).toEqual([t]);
  });

  it("snaps a single chosen weekday's date forward when it doesn't already match", () => {
    const t = makeTask({ date: "2026-07-06", recurrence: "weekdays", weekdays: [5] }); // Mon -> next Fri
    const result = splitWeekdayTask(t);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-07-10");
  });

  it("splits multiple chosen weekdays into one task per day, each on its own nearest match", () => {
    const t = makeTask({ date: "2026-07-06", recurrence: "weekdays", weekdays: [5, 2] }); // Fri, Tue
    const result = splitWeekdayTask(t);
    expect(result).toHaveLength(2);
    expect(result.map((r) => ({ weekdays: r.weekdays, date: r.date }))).toEqual([
      { weekdays: [2], date: "2026-07-07" }, // Tue
      { weekdays: [5], date: "2026-07-10" }, // Fri
    ]);
  });
});

describe("buildAgendaItems", () => {
  it("includes tasks and events regardless of deadline format", () => {
    const data = emptyUserData();
    data.tasks = [makeTask()];
    data.events = [{ id: "e1", date: "2026-07-10", title: "Event", color: "bg-primary" }];
    const items = buildAgendaItems(data);
    expect(items.map((i) => i.kind).sort()).toEqual(["event", "task"]);
  });

  it("only includes projects/goals with a real YYYY-MM-DD deadline", () => {
    const data = emptyUserData();
    data.projects = [
      { id: "p1", name: "No deadline", description: "", status: "Em andamento", deadline: "—", tasks: [] },
      { id: "p2", name: "Dated", description: "", status: "Em andamento", deadline: "2026-07-10", tasks: [] },
    ];
    data.goals = [
      { id: "g1", name: "No deadline", category: "C", deadline: "Sem prazo", milestones: [] },
      { id: "g2", name: "Dated", category: "C", deadline: "2026-07-11", milestones: [] },
    ];
    const items = buildAgendaItems(data);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.kind === "project")?.title).toBe("Dated");
    expect(items.find((i) => i.kind === "goal")?.title).toBe("Dated");
  });

  it("includes project tasks and milestones with their parent name", () => {
    const data = emptyUserData();
    data.projects = [
      {
        id: "p1",
        name: "Website",
        description: "",
        status: "Em andamento",
        deadline: "—",
        tasks: [{ id: "pt1", title: "Ship it", done: false, deadline: "2026-07-10" }],
      },
    ];
    data.goals = [
      {
        id: "g1",
        name: "Learn TS",
        category: "C",
        deadline: "Sem prazo",
        milestones: [{ id: "m1", name: "Finish course", done: false, deadline: "2026-07-10" }],
      },
    ];
    const items = buildAgendaItems(data);
    const pt = items.find((i) => i.kind === "project-task");
    const ms = items.find((i) => i.kind === "milestone");
    expect(pt).toMatchObject({ title: "Ship it", parentId: "p1", parentName: "Website" });
    expect(ms).toMatchObject({ title: "Finish course", parentId: "g1", parentName: "Learn TS" });
  });
});

describe("inAgendaFilter", () => {
  const today = "2026-07-10";
  // Midnight keeps the day-diff math exact (see inAgendaFilter's own
  // comment: it mirrors Agenda's pre-existing time-of-day-sensitive diff,
  // so testing from a non-midnight "now" would shift the boundary).
  const now = new Date("2026-07-10T00:00:00");

  it("hoje matches only today's key", () => {
    expect(inAgendaFilter("2026-07-10", "hoje", today, now)).toBe(true);
    expect(inAgendaFilter("2026-07-11", "hoje", today, now)).toBe(false);
  });

  it("semana includes yesterday through +7 days", () => {
    expect(inAgendaFilter("2026-07-09", "semana", today, now)).toBe(true);
    expect(inAgendaFilter("2026-07-17", "semana", today, now)).toBe(true);
    expect(inAgendaFilter("2026-07-18", "semana", today, now)).toBe(false);
    expect(inAgendaFilter("2026-07-08", "semana", today, now)).toBe(false);
  });

  it("todas matches everything", () => {
    expect(inAgendaFilter("2020-01-01", "todas", today, now)).toBe(true);
  });
});

describe("sortAgendaItems", () => {
  function item(overrides: Partial<AgendaItem>): AgendaItem {
    return { id: overrides.id ?? "x", kind: "task", sourceId: "x", date: "2026-07-10", title: "x", ...overrides };
  }

  it("padrao groups tasks before other kinds, keeping each kind's own order", () => {
    const items = [
      item({ id: "e1", kind: "event", title: "Event" }),
      item({ id: "t1", kind: "task", title: "Task 1" }),
      item({ id: "t2", kind: "task", title: "Task 2" }),
    ];
    const sorted = sortAgendaItems(items, "padrao");
    expect(sorted.map((i) => i.id)).toEqual(["t1", "t2", "e1"]);
  });

  it("horario sorts chronologically and pushes no-time items last", () => {
    const items = [
      item({ id: "a", time: undefined }),
      item({ id: "b", time: "09:00" }),
      item({ id: "c", time: "08:00" }),
    ];
    const sorted = sortAgendaItems(items, "horario");
    expect(sorted.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });

  it("prioridade sorts high/medium/low first, non-task kinds bucketed as none", () => {
    const items = [
      item({ id: "goal", kind: "goal" }),
      item({ id: "low", priority: "low" }),
      item({ id: "high", priority: "high" }),
    ];
    const sorted = sortAgendaItems(items, "prioridade");
    expect(sorted.map((i) => i.id)).toEqual(["high", "low", "goal"]);
  });
});
