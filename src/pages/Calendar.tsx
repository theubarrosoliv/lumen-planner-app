import { SectionHeader } from "@/components/SectionHeader";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays, Clock } from "lucide-react";
import { ScheduleView } from "@/components/ScheduleView";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Day cells show at most this many items before collapsing into "+N mais". */
const MAX_VISIBLE_EVENTS = 2;
/** Workload bar hits 100% width once a day has this many combined items. */
const LOAD_BAR_CAP = 5;

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

export function EventDialog({
  trigger,
  title: dialogTitle,
  initial,
  defaultDate,
  onSave,
  onDelete,
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
    duration?: number;
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
  /** Only offered when editing an existing event (`initial` set). */
  onDelete?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [color, setColor] = useState(initial?.color ?? "bg-primary");
  const [date, setDate] = useState(initial?.date ?? defaultDate ?? todayKey());
  const [time, setTime] = useState(initial?.time ?? "");
  const [duration, setDuration] = useState<number | undefined>(initial?.duration);
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
      duration,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setTitle("");
      setTime("");
      setTags([]);
      setDuration(undefined);
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
                Horário <span className="normal-case tracking-normal">(opc.)</span>
              </Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="max-w-[10rem] space-y-1.5">
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
        <DialogFooter className="sm:justify-between">
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
            >
              <Trash2 className="mr-1 h-4 w-4" /> Excluir
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} className="bg-gradient-primary shadow-elegant">
              Salvar
            </Button>
          </div>
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
  const toggleTask = useAppStore((s) => s.toggleTask);
  const { requestDelete, dialog } = useConfirmDelete();

  const [selected, setSelected] = useState<string>(todayKey());
  const [view, setView] = useState<"mes" | "cronograma">("mes");
  const [scheduleDate, setScheduleDate] = useState<string>(todayKey());

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

  /** Clicking (or activating via keyboard) a day drills straight into its
   * Cronograma — the month grid is an overview, not a place to read details. */
  const openDay = (key: string) => {
    setSelected(key);
    setScheduleDate(key);
    setView("cronograma");
  };

  // Roving tabindex for the month grid: exactly one cell is a tab stop at a
  // time (the selected day if it's in the visible month, else today, else
  // the first cell) so Tab enters/exits the grid in a single hop and arrow
  // keys move within it — same pattern as a native date picker.
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const focusPending = useRef<string | null>(null);
  const rovingKey = useMemo(() => {
    if (grid.some((c) => c?.key === selected)) return selected;
    const t = todayKey();
    if (grid.some((c) => c?.key === t)) return t;
    return grid.find((c): c is { d: number; key: string } => c !== null)?.key ?? null;
  }, [grid, selected]);

  useEffect(() => {
    if (focusPending.current && focusPending.current === selected) {
      cellRefs.current.get(selected)?.focus();
      focusPending.current = null;
    }
  }, [selected, grid]);

  const navigateDay = (fromKey: string, deltaDays: number) => {
    const [y, m, d] = fromKey.split("-").map(Number);
    const next = new Date(y, m - 1, d + deltaDays);
    const nextKey = dateKey(next);
    focusPending.current = nextKey;
    setSelected(nextKey);
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
      setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    }
  };

  const handleCellKeyDown = (e: React.KeyboardEvent, key: string) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        navigateDay(key, -1);
        break;
      case "ArrowRight":
        e.preventDefault();
        navigateDay(key, 1);
        break;
      case "ArrowUp":
        e.preventDefault();
        navigateDay(key, -7);
        break;
      case "ArrowDown":
        e.preventDefault();
        navigateDay(key, 7);
        break;
      case "Home":
        e.preventDefault();
        focusPending.current = todayKey();
        setSelected(todayKey());
        setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        openDay(key);
        break;
    }
  };

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

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-secondary/40 p-1 w-fit">
        {(
          [
            { key: "mes", label: "Mês", icon: CalendarDays },
            { key: "cronograma", label: "Cronograma", icon: Clock },
          ] as const
        ).map((v) => (
          <button
            key={v.key}
            onClick={() => {
              setView(v.key);
              if (v.key === "cronograma") setScheduleDate(todayKey());
            }}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs uppercase tracking-[0.2em] transition-all ${
              view === v.key
                ? "bg-gradient-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <v.icon className="h-3 w-3" />
            {v.label}
          </button>
        ))}
      </div>

      {view === "cronograma" ? (
        <ScheduleView
          date={scheduleDate}
          onDateChange={setScheduleDate}
          tasks={tasks}
          events={events}
          onToggleTask={toggleTask}
          renderEventTrigger={(event, block) => (
            <EventDialog
              key={event.id}
              title="Editar evento"
              initial={event}
              onSave={(v) => updateEvent(event.id, v)}
              onDelete={() =>
                requestDelete(() => removeEvent(event.id), {
                  title: "Excluir evento?",
                  description: `"${event.title}" será removido permanentemente.`,
                })
              }
              trigger={block}
            />
          )}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-gradient-card p-4 md:p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-2xl md:text-3xl" aria-live="polite">
              {monthNames[cursor.getMonth()]}{" "}
              <span className="text-muted-foreground">{cursor.getFullYear()}</span>
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
              >
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label="Próximo mês">
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
          </div>
          <div
            key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
            className="grid grid-cols-7 gap-1 animate-fade-in md:gap-2"
          >
            {grid.map((cell, i) => {
              if (!cell) return <div key={i} />;
              const evs = eventsFor(cell.key);
              const tks = tasksFor(cell.key);
              const isToday = cell.key === todayKey();
              const isSelected = cell.key === selected;
              const visibleEvents = evs.slice(0, MAX_VISIBLE_EVENTS);
              const hiddenCount = Math.max(0, evs.length - MAX_VISIBLE_EVENTS) + tks.length;
              const load = evs.length + tks.length;
              return (
                <div
                  key={cell.key}
                  ref={(el) => {
                    if (el) cellRefs.current.set(cell.key, el);
                    else cellRefs.current.delete(cell.key);
                  }}
                  role="button"
                  tabIndex={cell.key === rovingKey ? 0 : -1}
                  aria-pressed={isSelected}
                  aria-label={`Dia ${cell.d}${isToday ? ", hoje" : ""} — ${evs.length} evento${evs.length === 1 ? "" : "s"}, ${tks.length} tarefa${tks.length === 1 ? "" : "s"}`}
                  onClick={() => openDay(cell.key)}
                  onKeyDown={(e) => handleCellKeyDown(e, cell.key)}
                  className={cn(
                    "group relative flex min-h-[64px] flex-col rounded-xl border p-1.5 pb-3 text-left outline-none transition-colors md:min-h-[92px] md:p-2 md:pb-3.5",
                    "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    isSelected
                      ? "border-primary bg-gradient-sheen shadow-glow"
                      : isToday
                        ? "border-primary/50 bg-secondary/30 hover:border-primary/70"
                        : "border-border bg-background/40 hover:border-primary/30 hover:bg-secondary/20",
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-mono text-xs",
                        isToday ? "font-semibold text-primary-glow" : "text-muted-foreground",
                      )}
                    >
                      {String(cell.d).padStart(2, "0")}
                    </span>
                    {isToday && <span className="h-1 w-1 rounded-full bg-primary" />}
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {visibleEvents.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center gap-1 truncate rounded bg-secondary/60 px-1 py-0.5 text-[9px] md:text-[10px]"
                      >
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.color}`} />
                        <span className="truncate">{e.title}</span>
                      </div>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="truncate px-1 text-[9px] text-muted-foreground md:text-[10px]">
                        +{hiddenCount} mais
                      </div>
                    )}
                  </div>

                  {load > 0 && (
                    <div className="absolute inset-x-1.5 bottom-1.5 h-[3px] overflow-hidden rounded-full bg-border/50 md:inset-x-2">
                      <div
                        className="h-full rounded-full bg-gradient-primary"
                        style={{ width: `${Math.min(100, (load / LOAD_BAR_CAP) * 100)}%` }}
                      />
                    </div>
                  )}

                  <div
                    className="absolute right-1 top-1 hidden opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 md:block"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <EventDialog
                      title="Novo evento"
                      defaultDate={cell.key}
                      onSave={(v) => addEvent(v)}
                      trigger={
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={`Adicionar evento em ${cell.d}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {dialog}
    </div>
  );
}
