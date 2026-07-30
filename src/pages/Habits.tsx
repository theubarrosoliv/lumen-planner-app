import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Flame, Plus, Trash2, Pencil, Check, CalendarDays, Repeat, BarChart3 } from "lucide-react";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { Habit, HabitFrequency, NotifyLeadUnit } from "@/store/types";
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
  FREQUENCY_LABEL,
  FREQUENCY_UNIT,
  activeStreakPeriods,
  currentPeriodKey,
  lastNPeriods,
  streakOf,
  totalCompletions,
} from "@/lib/habits";
import { cn } from "@/lib/utils";
import { HabitsCharts } from "@/components/DashboardCharts";
import { NotifyField } from "@/components/NotifyField";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";

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
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [frequency, setFrequency] = useState<HabitFrequency>(
    (initial?.frequency as HabitFrequency) ?? "daily",
  );
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "hours");

  const submit = () => {
    if (!name.trim()) return toast.error("Dê um nome ao hábito.");
    onSave({ name: name.trim(), frequency, notify, notifyLeadValue, notifyLeadUnit });
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

export default function Habits() {
  const { habits } = useUserData();
  const addHabit = useAppStore((s) => s.addHabit);
  const updateHabit = useAppStore((s) => s.updateHabit);
  const removeHabit = useAppStore((s) => s.removeHabit);
  const toggleHabitPeriod = useAppStore((s) => s.toggleHabitPeriod);
  const { requestDelete, dialog } = useConfirmDelete();

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        eyebrow="Hábitos"
        title="Construa cadência."
        description="Defina a frequência ideal: diária, semanal ou mensal. A marca reseta sozinha — seu progresso permanece."
        action={
          <HabitDialog
            title="Novo hábito"
            onSave={(v) => addHabit(v.name, v.frequency, v.notify, v.notifyLeadValue, v.notifyLeadUnit)}
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
            const activeMask = activeStreakPeriods(h, periods);
            const completed = periods.filter((p) => h.completions[p]).length;
            const pct = Math.round((completed / periods.length) * 100);
            const streak = streakOf(h);
            const total = totalCompletions(h);
            const currentKey = currentPeriodKey(h);
            const doneNow = !!h.completions[currentKey];

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
                      <button
                        onClick={() => toggleHabitPeriod(h.id, currentKey)}
                        aria-pressed={doneNow}
                        aria-label={doneNow ? "Desmarcar hábito neste período" : "Marcar hábito como feito"}
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                          doneNow
                            ? "border-primary bg-gradient-primary"
                            : "border-border bg-secondary/40 hover:border-primary/40",
                        )}
                      >
                        {doneNow && <Check className="h-3.5 w-3.5 text-primary-foreground" />}
                      </button>
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
                        <button className="opacity-100 transition-opacity hover:text-primary-glow md:opacity-0 md:group-hover:opacity-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                      }
                    />
                    <button
                      onClick={() =>
                        requestDelete(() => removeHabit(h.id), {
                          title: "Excluir hábito?",
                          description: `"${h.name}" e todo o histórico de streak serão perdidos.`,
                        })
                      }
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
                          active
                            ? "bg-gradient-to-t from-primary to-primary-glow shadow-soft"
                            : "bg-secondary/60",
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
          })}
        </div>
      )}

      {dialog}
    </div>
  );
}
