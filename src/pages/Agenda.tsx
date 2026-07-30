import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Plus, Trash2, Pencil, Flag, Repeat } from "lucide-react";
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
import { useCustomOptions } from "@/hooks/use-custom-options";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useAppStore, useUserData, todayKey, dateKey } from "@/store/useAppStore";
import { Task, NotifyLeadUnit, TaskPriority, TaskRecurrence } from "@/store/types";
import { itemTags } from "@/lib/tags";
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

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

const RECURRENCE_LABEL: Record<TaskRecurrence, string> = {
  daily: "Repete diariamente",
  weekly: "Repete semanalmente",
  monthly: "Repete mensalmente",
};

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
    onSave({
      title: text.trim(),
      time: time || "—",
      tags,
      date,
      priority: priority === "none" ? undefined : priority,
      recurrence: recurrence === "none" ? undefined : recurrence,
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
                </SelectContent>
              </Select>
            </div>
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

export default function Agenda() {
  const { tasks } = useUserData();
  const addTask = useAppStore((s) => s.addTask);
  const toggleTask = useAppStore((s) => s.toggleTask);
  const removeTask = useAppStore((s) => s.removeTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const { requestDelete, dialog } = useConfirmDelete();

  const [filter, setFilter] = useState<"hoje" | "semana" | "todas">("hoje");

  const today = new Date();
  const filtered = tasks
    .filter((t) => {
      if (filter === "todas") return true;
      const d = new Date(t.date + "T00:00:00");
      if (filter === "hoje") return t.date === todayKey();
      if (filter === "semana") {
        const diff = (d.getTime() - today.getTime()) / 86400000;
        return diff >= -1 && diff <= 7;
      }
      return true;
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="mx-auto max-w-4xl">
      <SectionHeader
        eyebrow="Agenda"
        title="Tudo que importa hoje."
        description="Capture compromissos, organize por blocos e acompanhe seu progresso."
        action={
          <TaskDialog
            title="Nova tarefa"
            onSave={(t) => addTask(t)}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Nova tarefa
              </Button>
            }
          />
        }
      />

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-secondary/40 p-1 w-fit">
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

      <div className="rounded-2xl border border-border bg-gradient-card">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-display text-2xl text-muted-foreground">Nada por aqui ainda.</p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Adicione sua primeira tarefa.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((t, i) => (
              <li
                key={t.id}
                className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30 animate-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <button onClick={() => toggleTask(t.id)} className="shrink-0 transition-transform hover:scale-110">
                  {t.done ? (
                    <CheckCircle2 className="h-5 w-5 text-primary-glow" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
                <span className="text-mono w-14 text-xs text-muted-foreground">{t.time}</span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`flex items-center gap-1.5 text-sm ${
                      t.done ? "text-muted-foreground line-through" : ""
                    }`}
                  >
                    {t.priority && (
                      <Flag
                        className={`h-3 w-3 shrink-0 ${PRIORITY_STYLE[t.priority]}`}
                        fill="currentColor"
                      />
                    )}
                    <span className="truncate">{t.title}</span>
                    {t.recurrence && (
                      <Repeat
                        className="h-3 w-3 shrink-0 text-muted-foreground"
                        aria-label={RECURRENCE_LABEL[t.recurrence]}
                      />
                    )}
                  </p>
                  {t.date !== todayKey() && (
                    <p className="text-mono text-[10px] text-muted-foreground/60">{t.date}</p>
                  )}
                </div>
                <div className="hidden flex-wrap justify-end gap-1 md:flex">
                  {itemTags(t).map((tg) => (
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
                <TaskDialog
                  title="Editar tarefa"
                  initial={t}
                  onSave={(patch) => updateTask(t.id, patch)}
                  trigger={
                    <button className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                  }
                />
                <button
                  onClick={() =>
                    requestDelete(() => removeTask(t.id), {
                      title: "Excluir tarefa?",
                      description: `"${t.title}" será removida permanentemente.`,
                    })
                  }
                  className="opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {dialog}
    </div>
  );
}
