import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Plus, Trash2, Check, Pencil, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { toast } from "sonner";
import { Goal, Milestone } from "@/store/types";
import { GoalsCharts } from "@/components/DashboardCharts";

const CATEGORIES = ["Carreira", "Saúde", "Aprendizado", "Financeiro", "Pessoal"];

function fmtDate(d?: string) {
  if (!d) return "Sem prazo";
  // Accept "YYYY-MM-DD" or free text
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return d;
}

function GoalDialog({
  trigger,
  title,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: Partial<Goal>;
  onSave: (v: { name: string; category: string; deadline: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "Carreira");
  const [deadline, setDeadline] = useState(initial?.deadline === "Sem prazo" ? "" : initial?.deadline ?? "");

  const submit = () => {
    if (!name.trim()) return toast.error("Defina o nome da meta.");
    onSave({ name: name.trim(), category, deadline: deadline || "Sem prazo" });
    setOpen(false);
    if (!initial) {
      setName("");
      setDeadline("");
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Categoria
              </Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prazo</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
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

function MilestoneDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  initial?: Partial<Milestone>;
  onSave: (v: { name: string; deadline?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const submit = () => {
    if (!name.trim()) return toast.error("Nome do marco é obrigatório.");
    onSave({ name: name.trim(), deadline: deadline || undefined });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Editar marco</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prazo</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
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

export default function Goals() {
  const { goals } = useUserData();
  const addGoal = useAppStore((s) => s.addGoal);
  const updateGoal = useAppStore((s) => s.updateGoal);
  const removeGoal = useAppStore((s) => s.removeGoal);
  const toggleMilestone = useAppStore((s) => s.toggleMilestone);
  const addMilestone = useAppStore((s) => s.addMilestone);
  const updateMilestone = useAppStore((s) => s.updateMilestone);
  const removeMilestone = useAppStore((s) => s.removeMilestone);

  const [newMs, setNewMs] = useState<Record<string, { name: string; deadline: string }>>({});

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Metas"
        title="Onde você quer chegar."
        description="Defina marcos com prazos claros. Edite, ajuste e siga em frente."
        action={
          <GoalDialog
            title="Nova meta"
            onSave={(v) => addGoal({ ...v, milestones: [] })}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Nova meta
              </Button>
            }
          />
        }
      />

      {goals.length > 0 && (
        <div className="mb-6">
          <GoalsCharts />
        </div>
      )}

      {goals.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card py-16 text-center">
          <p className="font-display text-2xl text-muted-foreground">Nenhuma meta definida.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">Sonhos com prazo viram metas.</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {goals.map((g, i) => {
            const total = g.milestones.length || 1;
            const done = g.milestones.filter((m) => m.done).length;
            const pct = Math.round((done / total) * 100);
            const draft = newMs[g.id] ?? { name: "", deadline: "" };
            return (
              <div
                key={g.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 hover:shadow-elegant animate-rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gradient-primary opacity-20 blur-3xl transition-opacity group-hover:opacity-40" />
                <div className="relative">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase tracking-[0.25em] text-primary-glow">
                        {g.category}
                      </span>
                      <h3 className="mt-1 font-display text-2xl leading-tight">{g.name}</h3>
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarDays className="h-3 w-3" /> {fmtDate(g.deadline)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary/40">
                        <Target className="h-5 w-5 text-primary-glow" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <GoalDialog
                          title="Editar meta"
                          initial={g}
                          onSave={(v) => updateGoal(g.id, v)}
                          trigger={
                            <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover:opacity-100">
                              <Pencil className="h-4 w-4" />
                            </button>
                          }
                        />
                        <button
                          onClick={() => removeGoal(g.id)}
                          className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">Progresso</span>
                      <span className="text-mono text-primary-glow">{pct}%</span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>

                  <div className="space-y-1.5">
                    {g.milestones.map((m) => (
                      <div
                        key={m.id}
                        className="group/m flex items-center gap-2 rounded-md px-1 py-1 text-sm transition-colors hover:bg-secondary/40"
                      >
                        <button
                          onClick={() => toggleMilestone(g.id, m.id)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            m.done
                              ? "border-primary bg-gradient-primary"
                              : "border-border bg-secondary/40"
                          }`}
                        >
                          {m.done && <Check className="h-3 w-3 text-primary-foreground" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={m.done ? "truncate text-foreground" : "truncate text-muted-foreground"}>
                            {m.name}
                          </p>
                          {m.deadline && (
                            <p className="text-mono text-[10px] text-muted-foreground/70">
                              {fmtDate(m.deadline)}
                            </p>
                          )}
                        </div>
                        <MilestoneDialog
                          initial={m}
                          onSave={(v) => updateMilestone(g.id, m.id, v)}
                          trigger={
                            <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover/m:opacity-100">
                              <Pencil className="h-3 w-3" />
                            </button>
                          }
                        />
                        <button
                          onClick={() => removeMilestone(g.id, m.id)}
                          className="opacity-0 transition-opacity hover:text-destructive group-hover/m:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <Input
                        placeholder="Novo marco…"
                        value={draft.name}
                        onChange={(e) =>
                          setNewMs((p) => ({ ...p, [g.id]: { ...draft, name: e.target.value } }))
                        }
                        className="h-9 text-xs"
                      />
                      <Input
                        type="date"
                        value={draft.deadline}
                        onChange={(e) =>
                          setNewMs((p) => ({ ...p, [g.id]: { ...draft, deadline: e.target.value } }))
                        }
                        className="h-9 w-36 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() => {
                          const v = draft.name.trim();
                          if (!v) return;
                          addMilestone(g.id, v, draft.deadline || undefined);
                          setNewMs((p) => ({ ...p, [g.id]: { name: "", deadline: "" } }));
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
