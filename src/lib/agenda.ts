import { TaskPriority, TaskRecurrence, UserData } from "@/store/types";
import { itemTags } from "@/lib/tags";
import { timeToMinutes } from "@/lib/timeline";
import { PRIORITY_ORDER } from "@/lib/priority";

export type AgendaItemKind = "task" | "event" | "project" | "project-task" | "goal" | "milestone";

/** One row in the merged Agenda: a Task, CalEvent, Project/ProjectTask
 * deadline, or Goal/Milestone deadline, normalized to a common shape so the
 * page can filter/sort/render them together instead of only showing Tasks. */
export interface AgendaItem {
  id: string;
  kind: AgendaItemKind;
  sourceId: string;
  /** Project id (for project-task) or Goal id (for milestone) — lets the UI
   * call toggleProjectTask(parentId, sourceId) / toggleMilestone(...). */
  parentId?: string;
  parentName?: string;
  date: string;
  time?: string;
  title: string;
  done?: boolean;
  priority?: TaskPriority;
  recurrence?: TaskRecurrence;
  weekdays?: number[];
  intervalDays?: number;
  tags?: string[];
  /** Route to jump to for kinds that aren't editable inline from Agenda. */
  linkTo?: string;
}

/** Projects/goals default to the free-text placeholders "—"/"Sem prazo" when
 * no deadline is set — those don't belong on a dated Agenda. */
const isRealDate = (d?: string): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function buildAgendaItems(data: UserData): AgendaItem[] {
  const items: AgendaItem[] = [];

  for (const t of data.tasks) {
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      sourceId: t.id,
      date: t.date,
      time: t.time,
      title: t.title,
      done: t.done,
      priority: t.priority,
      recurrence: t.recurrence,
      weekdays: t.weekdays,
      intervalDays: t.intervalDays,
      tags: itemTags(t),
    });
  }

  for (const e of data.events) {
    items.push({
      id: `event-${e.id}`,
      kind: "event",
      sourceId: e.id,
      date: e.date,
      time: e.time,
      title: e.title,
      tags: itemTags(e),
      linkTo: "/calendario",
    });
  }

  for (const p of data.projects) {
    if (isRealDate(p.deadline)) {
      items.push({
        id: `project-${p.id}`,
        kind: "project",
        sourceId: p.id,
        date: p.deadline,
        title: p.name,
        done: p.status === "Concluído",
        linkTo: "/projetos",
      });
    }
    for (const pt of p.tasks) {
      if (isRealDate(pt.deadline)) {
        items.push({
          id: `project-task-${pt.id}`,
          kind: "project-task",
          sourceId: pt.id,
          parentId: p.id,
          parentName: p.name,
          date: pt.deadline,
          title: pt.title,
          done: pt.done,
          linkTo: "/projetos",
        });
      }
    }
  }

  for (const g of data.goals) {
    if (isRealDate(g.deadline)) {
      const allDone = g.milestones.length > 0 && g.milestones.every((m) => m.done);
      items.push({
        id: `goal-${g.id}`,
        kind: "goal",
        sourceId: g.id,
        date: g.deadline,
        title: g.name,
        done: allDone,
        linkTo: "/metas",
      });
    }
    for (const m of g.milestones) {
      if (isRealDate(m.deadline)) {
        items.push({
          id: `milestone-${m.id}`,
          kind: "milestone",
          sourceId: m.id,
          parentId: g.id,
          parentName: g.name,
          date: m.deadline,
          title: m.name,
          done: m.done,
          linkTo: "/metas",
        });
      }
    }
  }

  return items;
}

export type AgendaFilter = "hoje" | "semana" | "todas";
export type AgendaSort = "padrao" | "horario" | "prioridade";

/** Mirrors the date-window logic Agenda used for Tasks alone, generalized to
 * any dated item. `now` is injectable for tests. */
export function inAgendaFilter(
  dateStr: string,
  filter: AgendaFilter,
  todayKey: string,
  now: Date = new Date(),
): boolean {
  if (filter === "todas") return true;
  if (filter === "hoje") return dateStr === todayKey;
  const d = new Date(dateStr + "T00:00:00");
  const diff = (d.getTime() - now.getTime()) / 86400000;
  return diff >= -1 && diff <= 7;
}

/** Tasks come first (same relative order as before this merge shipped),
 * then the other kinds in their own natural order — so a day with only
 * tasks sorts exactly as it always did. */
const KIND_ORDER: Record<AgendaItemKind, number> = {
  task: 0,
  event: 1,
  "project-task": 2,
  project: 3,
  milestone: 4,
  goal: 5,
};

export function sortAgendaItems(items: AgendaItem[], sort: AgendaSort): AgendaItem[] {
  return items
    .map((it, idx) => ({ it, idx }))
    .sort((A, B) => {
      const a = A.it;
      const b = B.it;
      if (sort === "horario") {
        const aNoTime = timeToMinutes(a.time) === null;
        const bNoTime = timeToMinutes(b.time) === null;
        if (aNoTime !== bNoTime) return aNoTime ? 1 : -1;
        const cmp = (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""));
        return cmp !== 0 ? cmp : A.idx - B.idx;
      }
      if (sort === "prioridade") {
        const ap = PRIORITY_ORDER[a.priority ?? "none"];
        const bp = PRIORITY_ORDER[b.priority ?? "none"];
        return ap !== bp ? ap - bp : A.idx - B.idx;
      }
      const ak = KIND_ORDER[a.kind];
      const bk = KIND_ORDER[b.kind];
      return ak !== bk ? ak - bk : A.idx - B.idx;
    })
    .map((x) => x.it);
}
