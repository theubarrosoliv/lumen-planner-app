import { useState } from "react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Calendar as CalIcon, Trash2, Check, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NotifyField } from "@/components/NotifyField";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { toast } from "sonner";
import { Project, ProjectTask, NotifyLeadUnit } from "@/store/types";
import { ProjectsCharts } from "@/components/DashboardCharts";

const STATUS_STYLES: Record<Project["status"], string> = {
  Concluído: "border-success/40 text-success",
  Planejamento: "border-warning/40 text-warning",
  "Em andamento": "border-primary/40 text-primary-glow",
  "Não Iniciado": "border-border text-muted-foreground",
};

function fmtDate(d?: string) {
  if (!d || d === "—") return "Sem prazo";
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }
  return d;
}

function ProjectDialog({
  trigger,
  title,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  title: string;
  initial?: Partial<Project>;
  onSave: (v: {
    name: string;
    description: string;
    deadline: string;
    status: Project["status"];
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline && initial.deadline !== "—" ? initial.deadline : "");
  const [status, setStatus] = useState<Project["status"]>(initial?.status ?? "Não Iniciado");
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "days");

  const submit = () => {
    if (!name.trim()) return toast.error("Nome do projeto é obrigatório.");
    onSave({
      name: name.trim(),
      description: description.trim(),
      deadline: deadline || "—",
      status,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
    if (!initial) {
      setName("");
      setDescription("");
      setDeadline("");
      setStatus("Não Iniciado");
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
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Descrição</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Project["status"])}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option>Não Iniciado</option>
                <option>Planejamento</option>
                <option>Em andamento</option>
                <option>Concluído</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prazo</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
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

function ProjectTaskDialog({
  trigger,
  initial,
  onSave,
}: {
  trigger: React.ReactNode;
  initial?: Partial<ProjectTask>;
  onSave: (v: {
    title: string;
    deadline?: string;
    notify?: boolean;
    notifyLeadValue?: number;
    notifyLeadUnit?: NotifyLeadUnit;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [deadline, setDeadline] = useState(initial?.deadline ?? "");
  const [notify, setNotify] = useState(initial?.notify !== false);
  const [notifyLeadValue, setNotifyLeadValue] = useState<number | undefined>(initial?.notifyLeadValue);
  const [notifyLeadUnit, setNotifyLeadUnit] = useState<NotifyLeadUnit>(initial?.notifyLeadUnit ?? "days");
  const submit = () => {
    if (!title.trim()) return toast.error("Defina um título.");
    onSave({
      title: title.trim(),
      deadline: deadline || undefined,
      notify,
      notifyLeadValue,
      notifyLeadUnit,
    });
    setOpen(false);
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Editar tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Prazo</Label>
            <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
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

export default function Projects() {
  const { projects } = useUserData();
  const addProject = useAppStore((s) => s.addProject);
  const updateProject = useAppStore((s) => s.updateProject);
  const removeProject = useAppStore((s) => s.removeProject);
  const addProjectTask = useAppStore((s) => s.addProjectTask);
  const updateProjectTask = useAppStore((s) => s.updateProjectTask);
  const toggleProjectTask = useAppStore((s) => s.toggleProjectTask);
  const removeProjectTask = useAppStore((s) => s.removeProjectTask);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newTask, setNewTask] = useState<Record<string, { title: string; deadline: string }>>({});

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader
        eyebrow="Projetos"
        title="Trabalhos com começo, meio e fim."
        description="Organize iniciativas em fases e tarefas com prazo."
        action={
          <ProjectDialog
            title="Novo projeto"
            onSave={(v) => addProject(v)}
            trigger={
              <Button className="bg-gradient-primary shadow-elegant">
                <Plus className="mr-1 h-4 w-4" /> Novo projeto
              </Button>
            }
          />
        }
      />

      {projects.length > 0 && (
        <div className="mb-6">
          <ProjectsCharts />
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card py-16 text-center">
          <p className="font-display text-2xl text-muted-foreground">Nenhum projeto ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Comece pelo nome e siga decompondo em tarefas.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p, i) => {
            const total = p.tasks.length;
            const done = p.tasks.filter((t) => t.done).length;
            const pct = total ? Math.round((done / total) * 100) : 0;
            const isOpen = !!expanded[p.id];
            const draft = newTask[p.id] ?? { title: "", deadline: "" };
            return (
              <div
                key={p.id}
                className="group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-6 transition-all hover:border-primary/40 hover:shadow-elegant animate-rise"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <div className="mb-5 h-2 w-12 rounded-full bg-gradient-to-r from-primary to-primary-glow" />

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-display text-2xl leading-tight">{p.name}</h3>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <ProjectDialog
                      title="Editar projeto"
                      initial={p}
                      onSave={(v) => updateProject(p.id, v)}
                      trigger={
                        <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover:opacity-100">
                          <Pencil className="h-4 w-4" />
                        </button>
                      }
                    />
                    <button
                      onClick={() => removeProject(p.id)}
                      className="opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {done} de {total} tarefas
                    </span>
                    <span className="text-mono text-primary-glow">{pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-glow transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalIcon className="h-3.5 w-3.5" />
                    {fmtDate(p.deadline)}
                  </span>
                  <select
                    value={p.status}
                    onChange={(e) => updateProject(p.id, { status: e.target.value as Project["status"] })}
                    className={`rounded-full border bg-transparent px-2 py-0.5 text-[10px] uppercase tracking-wider ${STATUS_STYLES[p.status]}`}
                  >
                    <option>Não Iniciado</option>
                    <option>Planejamento</option>
                    <option>Em andamento</option>
                    <option>Concluído</option>
                  </select>
                </div>

                <button
                  onClick={() => setExpanded((s) => ({ ...s, [p.id]: !isOpen }))}
                  className="mt-4 flex w-full items-center justify-center gap-1 rounded-md border border-border bg-secondary/30 py-1.5 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground"
                >
                  {isOpen ? "Ocultar tarefas" : "Tarefas"}
                  {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2">
                    {p.tasks.map((t) => (
                      <div key={t.id} className="group/t flex items-center gap-2 text-sm">
                        <button
                          onClick={() => toggleProjectTask(p.id, t.id)}
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                            t.done ? "border-primary bg-gradient-primary" : "border-border"
                          }`}
                        >
                          {t.done && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <span
                            className={`block truncate ${t.done ? "line-through text-muted-foreground" : ""}`}
                          >
                            {t.title}
                          </span>
                          {t.deadline && (
                            <span className="text-mono text-[10px] text-muted-foreground/70">
                              {fmtDate(t.deadline)}
                            </span>
                          )}
                        </div>
                        <ProjectTaskDialog
                          initial={t}
                          onSave={(v) => updateProjectTask(p.id, t.id, v)}
                          trigger={
                            <button className="opacity-0 transition-opacity hover:text-primary-glow group-hover/t:opacity-100">
                              <Pencil className="h-3 w-3" />
                            </button>
                          }
                        />
                        <button
                          onClick={() => removeProjectTask(p.id, t.id)}
                          className="opacity-0 transition-opacity hover:text-destructive group-hover/t:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nova tarefa…"
                        value={draft.title}
                        onChange={(e) =>
                          setNewTask((s) => ({ ...s, [p.id]: { ...draft, title: e.target.value } }))
                        }
                        className="h-9 text-xs"
                      />
                      <Input
                        type="date"
                        value={draft.deadline}
                        onChange={(e) =>
                          setNewTask((s) => ({ ...s, [p.id]: { ...draft, deadline: e.target.value } }))
                        }
                        className="h-9 w-36 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9"
                        onClick={() => {
                          const v = draft.title.trim();
                          if (!v) return;
                          addProjectTask(p.id, v, draft.deadline || undefined);
                          setNewTask((s) => ({ ...s, [p.id]: { title: "", deadline: "" } }));
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
