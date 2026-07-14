import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Circle, Plus, Trash2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CreatableSelect } from "@/components/CreatableSelect";
import { NotifyField } from "@/components/NotifyField";
import { useCustomOptions } from "@/hooks/use-custom-options";
import { useAppStore, useUserData, todayKey, dateKey } from "@/store/useAppStore";
import { Task } from "@/store/types";
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
    tag: string;
    date: string;
    notes?: string;
    notify?: boolean;
    notifyMinutesBefore?: number;
  }) => void;
  trigger: React.ReactNode;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(initial?.title ?? "");
  const [time, setTime] = useState(initial?.time && initial.time !== "—" ? initial.time : "");
  const [tag, setTag] = useState(initial?.tag ?? "Foco");
  const [date, setDate] = useState(initial?.date ?? todayKey());
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyMinutesBefore, setNotifyMinutesBefore] = useState<number | undefined>(
    initial?.notifyMinutesBefore,
  );
  const { notificationPrefs } = useUserData();
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
    onSave({ title: text.trim(), time: time || "—", tag, date, notify, notifyMinutesBefore });
    setOpen(false);
    if (!initial) {
      setText("");
      setTime("");
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
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Categoria</Label>
            <CreatableSelect
              value={tag}
              onChange={setTag}
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
            timingKind="minutesBefore"
            timing={notifyMinutesBefore}
            onTimingChange={setNotifyMinutesBefore}
            globalDefault={notificationPrefs.taskReminderMinutesBefore}
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
                <div className="flex-1">
                  <p className={`text-sm ${t.done ? "text-muted-foreground line-through" : ""}`}>
                    {t.title}
                  </p>
                  {t.date !== todayKey() && (
                    <p className="text-mono text-[10px] text-muted-foreground/60">{t.date}</p>
                  )}
                </div>
                <span
                  className={`hidden rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider md:inline ${
                    tagColor[t.tag] ?? "border-border text-muted-foreground"
                  }`}
                >
                  {t.tag}
                </span>
                <TaskDialog
                  title="Editar tarefa"
                  initial={t}
                  onSave={(patch) => updateTask(t.id, patch)}
                  trigger={
                    <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover:opacity-100">
                      <Pencil className="h-4 w-4" />
                    </button>
                  }
                />
                <button
                  onClick={() => removeTask(t.id)}
                  className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
