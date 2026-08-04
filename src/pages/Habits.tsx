import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Flame,
  Plus,
  Trash2,
  Pencil,
  Check,
  CalendarDays,
  Repeat,
  BarChart3,
  Sunrise,
  Sun,
  Moon,
  LayoutList,
} from "lucide-react";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { DayPeriod, Habit, HabitFrequency, NotifyLeadUnit } from "@/store/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FREQUENCY_UNIT,
  activeStreakPeriods,
  currentPeriodKey,
  describeFrequency,
  isDueOn,
  lastNPeriods,
  streakOf,
  totalCompletions,
  weekProgress,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { HabitsCharts } from "@/components/DashboardCharts";
import { NotifyField } from "@/components/NotifyField";
import { WeekdaySelector } from "@/components/WeekdaySelector";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

const DAY_PERIOD_LABEL: Record<DayPeriod, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

const DAY_PERIOD_ICON: Record<DayPeriod, React.ElementType> = {
  manha: Sunrise,
  tarde: Sun,
  noite: Moon,
};

const DAY_PERIOD_ORDER: DayPeriod[] = ["manha", "tarde", "noite"];

/** Remembers the grouping choice across visits — it's a way of reading the
 * page, not something to re-pick every time. Kept in localStorage rather than
 * in the synced user data: it's a per-device view preference. */
const GROUP_PREF_KEY = "lumen-habits-group-by-period";

function HabitDialog({
  trigger,
  title,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: Partial<Habit>;
  onSave: (v: {
    name: string;
    frequency: HabitFrequency;
    weekdays?: number[];
    intervalDays?: number;
    timesPerWeek?: number;
    dayPeriod?: DayPeriod;
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [dayPeriod, setDayPeriod] = useState<DayPeriod | "none">(initial?.dayPeriod ?? "none");
  const [frequency, setFrequency] = useState<HabitFrequency>(
    (initial?.frequency as HabitFrequency) ?? "daily",
  );
  const [weekdays, setWeekdays] = useState<number[]>(initial?.weekdays ?? []);
  const [intervalDays, setIntervalDays] = useState<number | undefined>(initial?.intervalDays ?? 15);
  const [timesPerWeek, setTimesPerWeek] = useState<number | undefined>(initial?.timesPerWeek ?? 3);
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "hours");

  const submit = () => {
    if (!name.trim()) return toast.error("Dê um nome ao hábito.");
    if (frequency === "weekdays" && weekdays.length === 0) {
      return toast.error("Selecione ao menos um dia da semana.");
    }
    if (frequency === "every_n_days" && (!intervalDays || intervalDays < 2)) {
      return toast.error("Informe a cada quantos dias (mínimo 2).");
    }
    if (frequency === "times_per_week" && (!timesPerWeek || timesPerWeek < 1 || timesPerWeek > 7)) {
      return toast.error("Informe quantas vezes por semana (1 a 7).");
    }
    onSave({
      name: name.trim(),
      frequency,
      weekdays: frequency === "weekdays" ? weekdays : undefined,
      intervalDays: frequency === "every_n_days" ? intervalDays : undefined,
      timesPerWeek: frequency === "times_per_week" ? timesPerWeek : undefined,
      dayPeriod: dayPeriod === "none" ? undefined : dayPeriod,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setName("");
      setFrequency("daily");
      setWeekdays([]);
      setIntervalDays(15);
      setTimesPerWeek(3);
      setDayPeriod("none");
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
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Frequência
            </Label>
            <Select value={frequency} onValueChange={(v) => setFrequency(v as HabitFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diário · todo dia</SelectItem>
                <SelectItem value="weekly">Semanal · uma vez na semana</SelectItem>
                <SelectItem value="monthly">Mensal · uma vez no mês</SelectItem>
                <SelectItem value="weekdays">Dias específicos · você escolhe quais</SelectItem>
                <SelectItem value="every_n_days">A cada X dias</SelectItem>
                <SelectItem value="times_per_week">X vezes por semana · quaisquer dias</SelectItem>
              </SelectContent>
            </Select>
            {frequency === "weekdays" && (
              <div className="pt-1">
                <WeekdaySelector value={weekdays} onChange={setWeekdays} />
              </div>
            )}
            {frequency === "every_n_days" && (
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
            {frequency === "times_per_week" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={7}
                  step={1}
                  className="h-8 w-20"
                  value={timesPerWeek ?? ""}
                  onChange={(e) => setTimesPerWeek(e.target.value === "" ? undefined : Number(e.target.value))}
                />
                <span className="text-sm text-muted-foreground">vezes por semana, em qualquer dia</span>
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              A marca reseta no início de cada período. O histórico de streak e total são
              preservados.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Período do dia <span className="normal-case tracking-normal">(opc.)</span>
            </Label>
            <Select value={dayPeriod} onValueChange={(v) => setDayPeriod(v as DayPeriod | "none")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem período</SelectItem>
                {DAY_PERIOD_ORDER.map((p) => (
                  <SelectItem key={p} value={p}>
                    {DAY_PERIOD_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Serve só para organizar a lista — não define horário nem muda os lembretes.
            </p>
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

/** One habit's card. Extracted so the grouped and flat layouts render the
 * exact same card instead of keeping two copies of it in sync. */
function HabitCard({ habit: h, index, onDelete }: { habit: Habit; index: number; onDelete: () => void }) {
  const updateHabit = useAppStore((s) => s.updateHabit);
  const toggleHabitPeriod = useAppStore((s) => s.toggleHabitPeriod);

  const freq = h.frequency ?? "daily";
  const periodCount =
    freq === "daily" || freq === "weekdays"
      ? 21
      : freq === "every_n_days"
        ? 10
        : freq === "times_per_week"
          ? 14
          : 12;
  const periods = lastNPeriods(h, periodCount);
  const activeMask = activeStreakPeriods(h, periods);
  const completed = periods.filter((p) => h.completions[p]).length;
  const pct = Math.round((completed / periods.length) * 100);
  const streak = streakOf(h);
  const total = totalCompletions(h);
  const currentKey = currentPeriodKey(h);
  const doneNow = !!h.completions[currentKey];
  const dueToday = isDueOn(h, new Date());
  const week = freq === "times_per_week" ? weekProgress(h) : null;
  const PeriodIcon = h.dayPeriod ? DAY_PERIOD_ICON[h.dayPeriod] : null;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 animate-rise"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* identity strip */}
      <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-primary via-primary-glow to-transparent opacity-60" />

      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => dueToday && toggleHabitPeriod(h.id, currentKey)}
              disabled={!dueToday}
              aria-pressed={doneNow}
              aria-label={
                !dueToday
                  ? "Não programado para hoje"
                  : doneNow
                    ? "Desmarcar hábito neste período"
                    : "Marcar hábito como feito"
              }
              title={!dueToday ? "Não programado para hoje" : undefined}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                !dueToday
                  ? "cursor-not-allowed border-border bg-secondary/20 opacity-40"
                  : doneNow
                    ? "border-primary bg-gradient-primary"
                    : "border-border bg-secondary/40 hover:border-primary/40",
              )}
            >
              {doneNow && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
            </button>
            <h3 className="font-display text-xl leading-tight">{h.name}</h3>
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Repeat className="h-2.5 w-2.5" />
              {describeFrequency(h)}
            </span>
            {/* Also shown when grouping is off — otherwise the period a habit
                belongs to would be invisible outside the grouped view. */}
            {h.dayPeriod && PeriodIcon && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-primary-glow">
                <PeriodIcon className="h-2.5 w-2.5" />
                {DAY_PERIOD_LABEL[h.dayPeriod]}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {completed}/{periods.length} {FREQUENCY_UNIT[freq]} · {pct}%
            {week && ` · ${week.count}/${week.target} esta semana`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1">
            <Flame className="h-3.5 w-3.5 text-warning" />
            <span className="text-mono text-xs text-warning">{streak}</span>
          </div>
          <HabitDialog
            title="Editar hábito"
            initial={h}
            onSave={(v) => updateHabit(h.id, v)}
            trigger={
              <button className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100">
                <Pencil className="h-4 w-4" />
              </button>
            }
          />
          <button
            onClick={onDelete}
            className="opacity-100 transition-opacity hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* history grid — visual only */}
      <div
        className="mb-4 grid gap-1"
        style={{ gridTemplateColumns: `repeat(${periods.length}, 1fr)` }}
        aria-label="Histórico de períodos"
      >
        {periods.map((p, pi) => {
          const active = activeMask[pi];
          const isCurrent = p === currentKey;
          return (
            <div
              key={p}
              title={p}
              className={cn(
                "h-7 rounded-sm",
                active ? "bg-gradient-to-t from-primary to-primary-glow shadow-soft" : "bg-secondary/60",
                isCurrent && "ring-1 ring-primary-glow ring-offset-1 ring-offset-card",
              )}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> {currentKey}
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <BarChart3 className="h-3 w-3" /> {total}
          </span>
          <span>streak · {streak} {FREQUENCY_UNIT[freq]}</span>
        </span>
      </div>
    </div>
  );
}

export default function Habits() {
  const { habits } = useUserData();
  const addHabit = useAppStore((s) => s.addHabit);
  const removeHabit = useAppStore((s) => s.removeHabit);
  const { requestDelete, dialog } = useConfirmDelete();

  const [groupByPeriod, setGroupByPeriod] = useState(() => {
    try {
      return localStorage.getItem(GROUP_PREF_KEY) === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(GROUP_PREF_KEY, groupByPeriod ? "1" : "0");
    } catch {
      /* storage unavailable (private mode) — the choice just won't persist */
    }
  }, [groupByPeriod]);

  /** Habits bucketed by day period, in Manhã → Tarde → Noite order with the
   * unassigned ones last. Empty buckets are dropped so the page never shows a
   * heading with nothing under it. */
  const groups = useMemo(() => {
    const buckets = new Map<DayPeriod | "none", Habit[]>();
    for (const h of habits) {
      const key = h.dayPeriod ?? "none";
      buckets.set(key, [...(buckets.get(key) ?? []), h]);
    }
    return [...DAY_PERIOD_ORDER, "none" as const]
      .map((key) => ({ key, items: buckets.get(key) ?? [] }))
      .filter((g) => g.items.length > 0);
  }, [habits]);

  const askDelete = (h: Habit) =>
    requestDelete(() => removeHabit(h.id), {
      title: "Excluir hábito?",
      description: `"${h.name}" e todo o histórico de streak serão perdidos.`,
    });

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        eyebrow="Hábitos"
        title="Construa cadência."
        description="Defina a frequência ideal: diária, semanal ou mensal. A marca reseta sozinha — seu progresso permanece."
        action={
          <HabitDialog
            title="Novo hábito"
            onSave={(v) =>
              addHabit(
                v.name,
                v.frequency,
                v.notify,
                v.notifyLeadValue,
                v.notifyLeadUnit,
                v.weekdays,
                v.intervalDays,
                v.timesPerWeek,
                v.dayPeriod,
              )
            }
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Novo hábito
              </Button>
            }
          />
        }
      />

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card py-16 text-center">
          <p className="font-display text-2xl text-muted-foreground">Sem hábitos ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Comece com um pequeno gesto repetível.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => setGroupByPeriod((v) => !v)}
              aria-pressed={groupByPeriod}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition-all",
                groupByPeriod
                  ? "border-transparent bg-gradient-primary text-primary-foreground shadow-soft"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutList className="h-3 w-3" />
              Por período
            </button>
          </div>

          {groupByPeriod ? (
            <div className="space-y-8">
              {groups.map((g) => {
                const Icon = g.key === "none" ? null : DAY_PERIOD_ICON[g.key];
                return (
                  <section key={g.key}>
                    <h2 className="mb-3 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {Icon && <Icon className="h-3 w-3" />}
                      {g.key === "none" ? "Sem período" : DAY_PERIOD_LABEL[g.key]}
                      <span className="text-muted-foreground/50">· {g.items.length}</span>
                    </h2>
                    <div className="grid gap-4 md:grid-cols-2">
                      {g.items.map((h, i) => (
                        <HabitCard key={h.id} habit={h} index={i} onDelete={() => askDelete(h)} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {habits.map((h, i) => (
                <HabitCard key={h.id} habit={h} index={i} onDelete={() => askDelete(h)} />
              ))}
            </div>
          )}

          <div className="mt-8">
            <HabitsCharts />
          </div>
        </>
      )}

      {dialog}
    </div>
  );
}
