import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Plus, Trash2, Pencil, Check, CalendarDays, Repeat, BarChart3, CalendarPlus } from "lucide-react";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { Habit, HabitFrequency } from "@/store/types";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  FREQUENCY_LABEL,
  FREQUENCY_UNIT,
  currentPeriodKey,
  lastNPeriods,
  periodKeyFor,
  streakOf,
  totalCompletions,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { HabitsCharts } from "@/components/DashboardCharts";

function HabitDialog({
  trigger,
  title,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: Partial<Habit>;
  onSave: (v: { name: string; frequency: HabitFrequency }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(
    (initial?.frequency as HabitFrequency) ?? "daily",
  );

  const submit = () => {
    if (!name.trim()) return toast.error("Dê um nome ao hábito.");
    onSave({ name: name.trim(), frequency });
    setOpen(false);
    if (!initial) {
      setName("");
      setFrequency("daily");
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Meditar 10 min"
              autoFocus
            />
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
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              A marca reseta no início de cada período. O histórico de streak e total são
              preservados.
            </p>
          </div>
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

export default function Habits() {
  const { habits } = useUserData();
  const addHabit = useAppStore((s) => s.addHabit);
  const updateHabit = useAppStore((s) => s.updateHabit);
  const removeHabit = useAppStore((s) => s.removeHabit);
  const toggleHabitPeriod = useAppStore((s) => s.toggleHabitPeriod);

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        eyebrow="Hábitos"
        title="Construa cadência."
        description="Defina a frequência ideal: diária, semanal ou mensal. A marca reseta sozinha — seu progresso permanece."
        action={
          <HabitDialog
            title="Novo hábito"
            onSave={(v) => addHabit(v.name, v.frequency)}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Novo hábito
              </Button>
            }
          />
        }
      />

      {habits.length > 0 && (
        <div className="mb-6">
          <HabitsCharts />
        </div>
      )}

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card py-16 text-center">
          <p className="font-display text-2xl text-muted-foreground">Sem hábitos ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Comece com um pequeno gesto repetível.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {habits.map((h, i) => {
            const freq = h.frequency ?? "daily";
            const periods = lastNPeriods(freq, freq === "daily" ? 21 : 12);
            const completed = periods.filter((p) => h.completions[p]).length;
            const pct = Math.round((completed / periods.length) * 100);
            const streak = streakOf(h);
            const total = totalCompletions(h);
            const currentKey = currentPeriodKey(h);
            const doneNow = !!h.completions[currentKey];

            const ctaLabel = doneNow
              ? freq === "daily"
                ? "Feito hoje ✓"
                : freq === "weekly"
                  ? "Feito esta semana ✓"
                  : "Feito este mês ✓"
              : freq === "daily"
                ? "Marcar como feito hoje"
                : freq === "weekly"
                  ? "Marcar esta semana"
                  : "Marcar este mês";

            return (
              <div
                key={h.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 animate-rise"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {/* identity strip */}
                <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-primary via-primary-glow to-transparent opacity-60" />

                <div className="mb-4 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-xl leading-tight">{h.name}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        <Repeat className="h-2.5 w-2.5" />
                        {FREQUENCY_LABEL[freq]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {completed}/{periods.length} {FREQUENCY_UNIT[freq]} · {pct}%
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
                        <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover:opacity-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                      }
                    />
                    <button
                      onClick={() => removeHabit(h.id)}
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
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
                  {periods.map((p) => {
                    const done = !!h.completions[p];
                    const isCurrent = p === currentKey;
                    return (
                      <div
                        key={p}
                        title={p}
                        className={cn(
                          "h-7 rounded-sm",
                          done
                            ? "bg-gradient-to-t from-primary to-primary-glow shadow-soft"
                            : "bg-secondary/60",
                          isCurrent && "ring-1 ring-primary-glow ring-offset-1 ring-offset-card",
                        )}
                      />
                    );
                  })}
                </div>

                {/* check-list style toggle for current period — mark once, no unmark */}
                <button
                  onClick={() => {
                    if (doneNow) {
                      toast.info("Já marcado neste período.");
                      return;
                    }
                    toggleHabitPeriod(h.id, currentKey);
                  }}
                  disabled={doneNow}
                  aria-pressed={doneNow}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                    doneNow
                      ? "border-primary/50 bg-gradient-sheen text-foreground cursor-default"
                      : "border-border bg-secondary/30 hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                      doneNow ? "border-primary bg-gradient-primary" : "border-border bg-background/40",
                    )}
                  >
                    {doneNow && <Check className="h-3 w-3 text-primary-foreground" />}
                  </span>
                  <span className="flex-1">{ctaLabel}</span>
                  <span className="flex items-center gap-1 text-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    <BarChart3 className="h-3 w-3" />
                    {total}
                  </span>
                </button>

                <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground/80">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> {currentKey}
                  </span>
                  <span>streak · {streak} {FREQUENCY_UNIT[freq]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {habits.length > 0 && <BackdateFab habits={habits} />}
    </div>
  );
}

function BackdateFab({ habits }: { habits: Habit[] }) {
  const toggleHabitPeriod = useAppStore((s) => s.toggleHabitPeriod);
  const [open, setOpen] = useState(false);
  const [habitId, setHabitId] = useState<string>(habits[0]?.id ?? "");
  const [date, setDate] = useState<Date | undefined>(new Date());

  const habit = habits.find((h) => h.id === habitId) ?? habits[0];
  const freq = habit?.frequency ?? "daily";
  const targetKey = date ? periodKeyFor(freq, date) : "";
  const alreadyDone = habit && targetKey ? !!habit.completions[targetKey] : false;

  const apply = () => {
    if (!habit || !date) return;
    if (alreadyDone) {
      toast.info("Esse período já está marcado.");
      return;
    }
    toggleHabitPeriod(habit.id, targetKey);
    toast.success(`Marcado: ${habit.name} · ${targetKey}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Marcar período anterior"
          className="fixed bottom-[calc(1.5rem+theme(spacing.safe-bottom))] right-[calc(1.5rem+theme(spacing.safe-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:scale-95"
        >
          <CalendarPlus className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="top"
        sideOffset={12}
        className="w-[320px] rounded-2xl border-border bg-card p-3"
      >
        <div className="mb-2 px-1">
          <p className="font-display text-base">Marcar período anterior</p>
          <p className="text-[11px] text-muted-foreground">
            Selecione o hábito e a data — usamos o período correspondente.
          </p>
        </div>
        <div className="mb-3 px-1">
          <Select value={habitId} onValueChange={setHabitId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um hábito" />
            </SelectTrigger>
            <SelectContent>
              {habits.map((h) => (
                <SelectItem key={h.id} value={h.id}>
                  {h.name} · {FREQUENCY_LABEL[h.frequency ?? "daily"]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={(d) => d > new Date()}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <span className="text-[11px] text-muted-foreground">
            {targetKey ? `Período: ${targetKey}` : "—"}
            {alreadyDone && " · já marcado"}
          </span>
          <Button
            size="sm"
            onClick={apply}
            disabled={!date || alreadyDone}
            className="bg-gradient-primary shadow-elegant"
          >
            Marcar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
