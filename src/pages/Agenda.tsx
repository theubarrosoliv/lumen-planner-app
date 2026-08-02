import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { NotifyField } from "@/components/NotifyField";
import { WeekdaySelector } from "@/components/WeekdaySelector";
import { useCustomOptions } from "@/hooks/use-custom-options";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useAppStore, useUserData, todayKey } from "@/store/useAppStore";
import { Task, NotifyLeadUnit, TaskPriority, TaskRecurrence } from "@/store/types";
import { itemTags } from "@/lib/tags";
import { PRIORITY_STYLE } from "@/lib/priority";
import { describeRecurrence } from "@/lib/date";
import { splitWeekdayTask } from "@/lib/tasks";
import {
  AgendaItem,
  AgendaItemKind,
  buildAgendaItems,
  inAgendaFilter,
  sortAgendaItems,
} from "@/lib/agenda";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const tagColor: Record<string, string> = {
  Hábito: "border-warning/40 text-warning",
  Foco: "border-primary/40 text-primary-glow",
  Reunião: "border-success/40 text-success",
  Saúde: "border-destructive/40 text-destructive",
  Trabalho: "border-primary/40 text-primary-glow",
  Pessoal: "border-border text-muted-foreground",
};

const TAGS = ["Foco", "Trabalho", "Reunião", "Hábito", "Saúde", "Pessoal"];

function TaskDialog({
  initial,
  onSave,
  trigger,
  title,
}: {
  initial?: Partial<Task>;
  onSave: (t: {
    time: string;
    title: string;
    tags: string[];
    date: string;
    notes?: string;
    priority?: TaskPriority;
    recurrence?: TaskRecurrence;
    weekdays?: number[];
    intervalDays?: number;
    duration?: number;
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
  trigger: React.ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial?.title ?? "");
  const [time, setTime] = useState(initial?.time && initial.time !== "—" ? initial.time : "");
  const [tags, setTags] = useState<string[]>(initial ? itemTags(initial) : []);
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [priority, setPriority] = useState<TaskPriority | "none">(initial?.priority ?? "none");
  const [recurrence, setRecurrence] = useState<TaskRecurrence | "none">(initial?.recurrence ?? "none");
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [intervalDays, setIntervalDays] = useState<number | undefined>(initial?.intervalDays ?? 15);
  const [duration, setDuration] = useState<number | undefined>(initial?.duration);
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "minutes");
  const {
    options: tagOptions,
    custom: customTags,
    addOption: addTagOption,
    removeOption: removeTagOption,
    renameOption: renameTagOption,
  } = useCustomOptions("lumen-custom-tags", TAGS);

  const submit = () => {
    if (!text.trim()) {
      toast.error("Dê um título à tarefa.");
      return;
    }
    if (recurrence === "weekdays" && weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana.");
      return;
    }
    if (recurrence === "every_n_days" && (!intervalDays || intervalDays < 2)) {
      toast.error("Informe a cada quantos dias (mínimo 2).");
      return;
    }
    onSave({
      title: text.trim(),
      time: time || "—",
      tags,
      date,
      priority: priority === "none" ? undefined : priority,
      recurrence: recurrence === "none" ? undefined : recurrence,
      weekdays: recurrence === "weekdays" ? weekdays : undefined,
      intervalDays: recurrence === "every_n_days" ? intervalDays : undefined,
      duration,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setText("");
      setTime("");
      setTags([]);
      setPriority("none");
      setRecurrence("none");
      setWeekdays([]);
      setIntervalDays(15);
      setDuration(undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Título</Label>
            <Input value={text} onChange={(e) => setText(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Hora</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Duração (min)
              </Label>
              <Input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min={0}
                step={5}
                placeholder="60"
                value={duration ?? ""}
                onChange={(e) => setDuration(e.target.value === "" ? undefined : Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Prioridade
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem prioridade</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Repetir
            </Label>
            <Select
              value={recurrence}
              onValueChange={(v) => setRecurrence(v as TaskRecurrence | "none")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não repetir</SelectItem>
                <SelectItem value="daily">Diariamente</SelectItem>
                <SelectItem value="weekly">Semanalmente</SelectItem>
                <SelectItem value="monthly">Mensalmente</SelectItem>
                <SelectItem value="weekdays">Dias da semana…</SelectItem>
                <SelectItem value="every_n_days">A cada X dias…</SelectItem>
              </SelectContent>
            </Select>
            {recurrence === "weekdays" && (
              <div className="pt-1">
                <WeekdaySelector value={weekdays} onChange={setWeekdays} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  A tarefa se repete nos dias marcados — escolha mais de um para "N vezes por semana".
                </p>
              </div>
            )}
            {recurrence === "every_n_days" && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-sm text-muted-foreground">A cada</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  step={1}
                  className="h-8 w-20"
                  value={intervalDays ?? ""}
                  onChange={(e) => setIntervalDays(e.target.value === "" ? undefined : Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tags</Label>
            <TagMultiSelect
              value={tags}
              onChange={setTags}
              options={tagOptions}
              onCreate={addTagOption}
              customOptions={customTags}
              onRemove={removeTagOption}
              onRename={renameTagOption}
            />
          </div>
          <NotifyField
            notify={notify}
            onNotifyChange={setNotify}
            leadValue={notifyLeadValue}
            leadUnit={notifyLeadUnit}
            onLeadValueChange={setNotifyLeadValue}
            onLeadUnitChange={setNotifyLeadUnit}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} className="bg-gradient-primary shadow-elegant">
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
          <TaskDialog
            title="Nova tarefa"
            onSave={(t) => splitWeekdayTask(t).forEach(addTask)}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Nova tarefa
              </Button>
            }
          />
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
                      onClick={() => it.linkTo && navigate(it.linkTo)}
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
                        onClick={() => navigate(it.linkTo!)}
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
