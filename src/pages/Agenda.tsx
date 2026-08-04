import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Pencil,
  Flag,
  Repeat,
  CalendarDays,
  FolderKanban,
  Target,
  ArrowUpRight,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TaskDialog } from "@/components/TaskDialog";
import { VoiceTaskCapture } from "@/components/VoiceTaskCapture";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useAppStore, useUserData, todayKey } from "@/store/useAppStore";
import { PRIORITY_STYLE } from "@/lib/priority";
import { describeRecurrence } from "@/lib/date";
import { materializeRecurringTask, splitWeekdayTask } from "@/lib/tasks";
import {
  AgendaItem,
  AgendaItemKind,
  buildAgendaItems,
  inAgendaFilter,
  sortAgendaItems,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";

const tagColor: Record<string, string> = {
  Hábito: "border-warning/40 text-warning",
  Foco: "border-primary/40 text-primary-glow",
  Reunião: "border-success/40 text-success",
  Saúde: "border-destructive/40 text-destructive",
  Trabalho: "border-primary/40 text-primary-glow",
  Pessoal: "border-border text-muted-foreground",
};

const KIND_LABEL: Record<AgendaItemKind, string> = {
  task: "Tarefa",
  event: "Evento",
  project: "Projeto",
  "project-task": "Tarefa de projeto",
  goal: "Meta",
  milestone: "Marco",
};

const KIND_ICON: Record<Exclude<AgendaItemKind, "task" | "project-task">, React.ElementType> = {
  event: CalendarDays,
  project: FolderKanban,
  goal: Target,
  milestone: Target,
};

const isToggleableKind = (k: AgendaItemKind) =>
  k === "task" || k === "project-task" || k === "milestone";

export default function Agenda() {
  const data = useUserData();
  const navigate = useNavigate();
  const addTask = useAppStore((s) => s.addTask);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const removeTask = useAppStore((s) => s.removeTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const toggleProjectTask = useAppStore((s) => s.toggleProjectTask);
  const toggleMilestone = useAppStore((s) => s.toggleMilestone);
  const { requestDelete, dialog } = useConfirmDelete();

  const [filter, setFilter] = useState<"hoje" | "semana" | "todas">("hoje");
  const [sort, setSort] = useState<"padrao" | "horario" | "prioridade">("padrao");

  const items = useMemo(() => buildAgendaItems(data), [data]);
  const filtered = useMemo(() => {
    const inWindow = items.filter((it) => inAgendaFilter(it.date, filter, todayKey()));
    return sortAgendaItems(inWindow, sort);
  }, [items, filter, sort]);

  const toggleItem = (it: AgendaItem) => {
    if (it.kind === "task") toggleTask(it.sourceId);
    else if (it.kind === "project-task" && it.parentId) toggleProjectTask(it.parentId, it.sourceId);
    else if (it.kind === "milestone" && it.parentId) toggleMilestone(it.parentId, it.sourceId);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        eyebrow="Agenda"
        title="Tudo que importa hoje."
        description="Capture compromissos, organize por blocos e acompanhe seu progresso."
        action={
          <div className="flex items-center gap-2">
            <VoiceTaskCapture />
            <TaskDialog
              title="Nova tarefa"
              onSave={(t) => materializeRecurringTask(t).forEach(addTask)}
              trigger={
                <Button className="bg-gradient-primary shadow-elegant">
                  <Plus className="mr-1 h-4 w-4" /> Nova tarefa
                </Button>
              }
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border border-border bg-secondary/40 p-1 w-fit">
          {(["hoje", "semana", "todas"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1 text-xs uppercase tracking-[0.2em] transition-all ${
                filter === f
                  ? "bg-gradient-primary text-primary-foreground shadow-soft"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger className="h-8 w-[9.5rem] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="padrao">Padrão</SelectItem>
            <SelectItem value="horario">Horário</SelectItem>
            <SelectItem value="prioridade">Prioridade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-2xl text-muted-foreground">Nada por aqui ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Adicione sua primeira tarefa, ou crie um compromisso em Eventos, Projetos ou Metas.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((it, i) => {
              const task = it.kind === "task" ? data.tasks.find((t) => t.id === it.sourceId) : undefined;
              const Icon = it.kind !== "task" && it.kind !== "project-task" ? KIND_ICON[it.kind] : null;

              return (
                <li
                  key={it.id}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30 animate-rise"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
                >
                  {isToggleableKind(it.kind) ? (
                    <button
                      onClick={() => toggleItem(it)}
                      className="shrink-0 transition-transform hover:scale-110"
                    >
                      {it.done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary-glow" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => it.linkTo && navigate(it.linkTo, { state: { subTab: it.subTab } })}
                      aria-label={`Ver em ${KIND_LABEL[it.kind]}`}
                      className={cn(
                        "shrink-0 text-muted-foreground transition-colors hover:text-primary-glow",
                        it.done && "opacity-60",
                      )}
                    >
                      {Icon && <Icon className="h-5 w-5" />}
                    </button>
                  )}
                  <span className="text-mono w-14 shrink-0 text-xs text-muted-foreground">
                    {it.time ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`flex items-center gap-1.5 text-sm ${
                        it.done ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {it.priority && (
                        <Flag
                          className={`h-3 w-3 shrink-0 ${PRIORITY_STYLE[it.priority]}`}
                          fill="currentColor"
                        />
                      )}
                      <span className="truncate">{it.title}</span>
                      {it.recurrence && (
                        <Repeat
                          className="h-3 w-3 shrink-0 text-muted-foreground"
                          aria-label={describeRecurrence(it)}
                        />
                      )}
                    </p>
                    <p className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground/60">
                      {it.kind !== "task" && (
                        <span className="uppercase tracking-wider">
                          {KIND_LABEL[it.kind]}
                          {it.parentName ? ` · ${it.parentName}` : ""}
                        </span>
                      )}
                      {it.date !== todayKey() && <span className="text-mono">{it.date}</span>}
                    </p>
                  </div>
                  {it.tags && it.tags.length > 0 && (
                    <div className="hidden flex-wrap justify-end gap-1 md:flex">
                      {it.tags.map((tg) => (
                        <span
                          key={tg}
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${
                            tagColor[tg] ?? "border-border text-muted-foreground"
                          }`}
                        >
                          {tg}
                        </span>
                      ))}
                    </div>
                  )}
                  {task ? (
                    <>
                      <TaskDialog
                        title="Editar tarefa"
                        initial={task}
                        onSave={(patch) => {
                          const [first, ...rest] = splitWeekdayTask(patch);
                          updateTask(task.id, first);
                          rest.forEach(addTask);
                        }}
                        trigger={
                          <button className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100">
                            <Pencil className="h-4 w-4" />
                          </button>
                        }
                      />
                      <button
                        onClick={() =>
                          requestDelete(() => removeTask(task.id), {
                            title: "Excluir tarefa?",
                            description: `"${task.title}" será removida permanentemente.`,
                          })
                        }
                        className="opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    it.linkTo && (
                      <button
                        onClick={() => navigate(it.linkTo!, { state: { subTab: it.subTab } })}
                        aria-label={`Ver em ${KIND_LABEL[it.kind]}`}
                        className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dialog}
    </div>
  );
}
