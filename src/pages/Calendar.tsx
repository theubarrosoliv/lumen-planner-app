import { SectionHeader } from "@/components/SectionHeader";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotifyField } from "@/components/NotifyField";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { useCustomOptions } from "@/hooks/use-custom-options";
import { useAppStore, useUserData, dateKey, todayKey } from "@/store/useAppStore";
import { CalEvent, NotifyLeadUnit } from "@/store/types";
import { itemTags } from "@/lib/tags";
import { toast } from "sonner";

const TAGS = ["Foco", "Trabalho", "Reunião", "Hábito", "Saúde", "Pessoal"];

const monthNames = [
  "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
  "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
];
const dayLabels = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

const COLORS = [
  { v: "bg-primary", label: "Bronze" },
  { v: "bg-primary-glow", label: "Bronze claro" },
  { v: "bg-success", label: "Verde" },
  { v: "bg-warning", label: "Âmbar" },
  { v: "bg-destructive", label: "Vermelho" },
];

function EventDialog({
  trigger,
  title: dialogTitle,
  initial,
  defaultDate,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: Partial<CalEvent>;
  defaultDate?: string;
  onSave: (v: {
    title: string;
    date: string;
    time?: string;
    color: string;
    tags: string[];
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color ?? "bg-primary");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayKey());
  const [time, setTime] = useState(initial?.time ?? "");
  const [tags, setTags] = useState<string[]>(initial ? itemTags(initial) : []);
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "hours");
  const {
    options: tagOptions,
    custom: customTags,
    addOption: addTagOption,
    removeOption: removeTagOption,
    renameOption: renameTagOption,
  } = useCustomOptions("lumen-custom-tags", TAGS);

  const submit = () => {
    if (!title.trim()) return toast.error("Defina o título do evento.");
    onSave({
      title: title.trim(),
      date,
      time: time || undefined,
      color,
      tags,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setTitle("");
      setTime("");
      setTags([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{dialogTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Horário <span className="normal-case tracking-normal">(opcional)</span>
              </Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cor</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c.v}
                  type="button"
                  onClick={() => setColor(c.v)}
                  className={`h-8 w-8 rounded-full border-2 transition-all ${c.v} ${
                    color === c.v ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  title={c.label}
                />
              ))}
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

export default function CalendarPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const { events, tasks } = useUserData();
  const addEvent = useAppStore((s) => s.addEvent);
  const updateEvent = useAppStore((s) => s.updateEvent);
  const removeEvent = useAppStore((s) => s.removeEvent);
  const { requestDelete, dialog } = useConfirmDelete();

  const [selected, setSelected] = useState<string>(todayKey());

  const grid = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const startDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: ({ d: number; key: string } | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ d, key: dateKey(new Date(year, month, d)) });
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const eventsFor = (key: string) => events.filter((e) => e.date === key);
  const tasksFor = (key: string) => tasks.filter((t) => t.date === key);

  const shift = (delta: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1));

  const selectedEvents = eventsFor(selected);
  const selectedTasks = tasksFor(selected);

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Calendário"
        title="Sua visão de longo alcance."
        description="Compromissos, marcos e datas importantes em uma única tela."
        action={
          <EventDialog
            title="Novo evento"
            defaultDate={selected}
            onSave={(v) => addEvent(v)}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Novo evento
              </Button>
            }
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-border bg-gradient-card p-4 md:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl md:text-3xl">
              {monthNames[cursor.getMonth()]}{" "}
              <span className="text-muted-foreground">{cursor.getFullYear()}</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              >
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 md:gap-2">
            {dayLabels.map((d) => (
              <div key={d} className="pb-2 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {d}
              </div>
            ))}
            {grid.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const evs = eventsFor(cell.key);
              const tks = tasksFor(cell.key);
              const isToday = cell.key === todayKey();
              const isSelected = cell.key === selected;
              return (
                <button
                  key={cell.key}
                  onClick={() => setSelected(cell.key)}
                  className={`relative min-h-[64px] md:min-h-[88px] rounded-xl border p-1.5 md:p-2 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-gradient-sheen shadow-glow"
                      : isToday
                      ? "border-primary/60 bg-secondary/30"
                      : "border-border bg-background/40 hover:border-primary/30"
                  }`}
                >
                  <span
                    className={`text-mono text-xs ${
                      isToday ? "text-primary-glow" : "text-muted-foreground"
                    }`}
                  >
                    {String(cell.d).padStart(2, "0")}
                  </span>
                  <div className="mt-1 space-y-0.5">
                    {evs.slice(0, 2).map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-1 truncate rounded bg-secondary/60 px-1 py-0.5 text-[9px] md:text-[10px]"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.color}`} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {tks.length > 0 && (
                      <div className="text-[9px] md:text-[10px] text-muted-foreground">
                        +{tks.length} tarefa{tks.length > 1 ? "s" : ""}
                      </div>
                    )}
                    {evs.length > 2 && (
                      <div className="text-[9px] text-muted-foreground">
                        +{evs.length - 2} mais
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="rounded-2xl border border-border bg-gradient-card p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Selecionado</p>
          <h3 className="font-display text-xl">{selected}</h3>

          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Eventos</p>
            {selectedEvents.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Nenhum evento.</p>
            ) : (
              <ul className="space-y-2">
                {selectedEvents.map((e) => (
                  <li
                    key={e.id}
                    className="group flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${e.color}`} />
                    {e.time && (
                      <span className="text-mono shrink-0 text-xs text-muted-foreground">{e.time}</span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{e.title}</span>
                    {itemTags(e).length > 0 && (
                      <span className="hidden shrink-0 truncate text-[10px] uppercase tracking-wider text-muted-foreground/70 sm:inline">
                        {itemTags(e).join(" · ")}
                      </span>
                    )}
                    <EventDialog
                      title="Editar evento"
                      initial={e}
                      onSave={(v) => updateEvent(e.id, v)}
                      trigger={
                        <button className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      }
                    />
                    <button
                      onClick={() =>
                        requestDelete(() => removeEvent(e.id), {
                          title: "Excluir evento?",
                          description: `"${e.title}" será removido permanentemente.`,
                        })
                      }
                      className="opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-5">
            <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tarefas</p>
            {selectedTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground/60">Sem tarefas.</p>
            ) : (
              <ul className="space-y-2">
                {selectedTasks.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  >
                    <span className="text-mono w-12 text-xs text-muted-foreground">{t.time}</span>
                    <span className={`flex-1 truncate ${t.done ? "line-through text-muted-foreground" : ""}`}>
                      {t.title}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
      {dialog}
    </div>
  );
}
