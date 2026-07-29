import { SectionHeader } from "@/components/SectionHeader";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Target,
  Clock,
  ArrowUpRight,
  CalendarDays,
  Repeat,
} from "lucide-react";
import { useAppStore, useUserData, todayKey } from "@/store/useAppStore";
import { Link, useNavigate } from "react-router-dom";
import {
  FREQUENCY_LABEL,
  currentPeriodKey,
  lastNPeriods,
  streakOf,
} from "@/lib/habits";
import { formatDeadline, capitalizeWords } from "@/lib/date";

const QUICK_ADD = [
  { label: "Tarefa", to: "/agenda", icon: CheckCircle2 },
  { label: "Evento", to: "/calendario", icon: CalendarDays },
  { label: "Hábito", to: "/habitos", icon: Repeat },
  { label: "Meta", to: "/metas", icon: Target },
];


export default function Dashboard() {
  const { tasks, habits, goals, projects } = useUserData();
  const toggleTask = useAppStore((s) => s.toggleTask);
  const toggleHabitPeriod = useAppStore((s) => s.toggleHabitPeriod);
  const user = useAppStore((s) => s.currentUser());
  const navigate = useNavigate();

  const todayTasks = tasks
    .filter((t) => t.date === todayKey())
    .sort((a, b) => a.time.localeCompare(b.time));
  const completed = todayTasks.filter((t) => t.done).length;

  const topStreak = habits.reduce(
    (acc, h) => {
      const s = streakOf(h);
      return s > acc.s ? { s, name: h.name } : acc;
    },
    { s: 0, name: "—" },
  );

  const habitsTodayDone = habits.filter((h) => h.completions[currentPeriodKey(h)]).length;

  const goalsProgress =
    goals.length === 0
      ? 0
      : Math.round(
          goals.reduce((acc, g) => {
            const t = g.milestones.length || 1;
            const d = g.milestones.filter((m) => m.done).length;
            return acc + d / t;
          }, 0) /
            goals.length *
            100,
        );

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const firstName = capitalizeWords(user?.name.split(" ")[0] ?? "");

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto max-w-7xl">
      <SectionHeader
        eyebrow={today}
        title={`${greet}${firstName ? `, ${firstName}` : ""}.`}
        description={
          tasks.length === 0 && habits.length === 0
            ? "Tudo começa com um primeiro item. Crie sua primeira tarefa ou hábito."
            : `Você tem ${todayTasks.length} compromisso${todayTasks.length !== 1 ? "s" : ""} e ${habits.length} hábito${habits.length !== 1 ? "s" : ""} hoje.`
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.02]">
                <Plus className="mr-1 h-4 w-4" /> Novo item
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {QUICK_ADD.map((q) => (
                <DropdownMenuItem
                  key={q.to}
                  onClick={() => navigate(q.to)}
                  className="cursor-pointer"
                >
                  <q.icon className="mr-2 h-4 w-4" />
                  {q.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Tarefas hoje"
          value={`${completed}/${todayTasks.length}`}
          hint={todayTasks.length === 0 ? "Sem tarefas" : "No ritmo certo"}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="primary"
        />
        <StatCard
          label="Streak ativo"
          value={`${topStreak.s}d`}
          hint={topStreak.name}
          icon={<Flame className="h-5 w-5" />}
          accent="warning"
        />
        <StatCard
          label="Hábitos hoje"
          value={`${habitsTodayDone}/${habits.length}`}
          hint={habits.length === 0 ? "Crie um hábito" : "Em construção"}
          icon={<Clock className="h-5 w-5" />}
          accent="success"
        />
        <StatCard
          label="Metas"
          value={`${goalsProgress}%`}
          hint={`${goals.length} ativa${goals.length !== 1 ? "s" : ""}`}
          icon={<Target className="h-5 w-5" />}
          accent="muted"
        />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-gradient-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-display text-2xl">Agenda do dia</h2>
                <p className="text-xs text-muted-foreground">
                  {todayTasks.length} compromisso{todayTasks.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Link to="/agenda">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Ver tudo <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>

            {todayTasks.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center">
                <p className="text-sm text-muted-foreground">Nada agendado para hoje.</p>
                <Link to="/agenda">
                  <Button variant="ghost" size="sm" className="mt-2">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar tarefa
                  </Button>
                </Link>
              </div>
            ) : (
              <ul className="space-y-2">
                {todayTasks.map((task, i) => (
                  <li
                    key={task.id}
                    className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-all hover:border-border hover:bg-secondary/40 animate-rise"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <button onClick={() => toggleTask(task.id)} className="shrink-0 transition-transform hover:scale-110">
                      {task.done ? (
                        <CheckCircle2 className="h-5 w-5 text-primary-glow" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>
                    <span className="text-mono w-14 text-xs text-muted-foreground">{task.time}</span>
                    <p className={`flex-1 text-sm transition-all ${task.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {task.title}
                    </p>
                    <span className="hidden rounded-full border border-border bg-secondary/60 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
                      {task.tag}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-gradient-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-2xl">Metas em movimento</h2>
              <Link to="/metas">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                  Ver todas <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
            {goals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma meta cadastrada.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {goals.slice(0, 4).map((g, i) => {
                  const total = g.milestones.length || 1;
                  const done = g.milestones.filter((m) => m.done).length;
                  const pct = Math.round((done / total) * 100);
                  return (
                    <div key={g.id} className="animate-rise" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="mb-2 flex items-baseline justify-between">
                        <p className="text-sm font-medium">{g.name}</p>
                        <p className="text-mono text-xs text-muted-foreground">
                          {pct}% · {formatDeadline(g.deadline)}
                        </p>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-gradient-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Hábitos</h2>
              <Flame className="h-4 w-4 text-warning" />
            </div>
            {habits.length === 0 ? (
              <Link to="/habitos">
                <div className="rounded-xl border border-dashed border-border py-8 text-center hover:border-primary/40">
                  <p className="text-sm text-muted-foreground">Criar primeiro hábito</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-4">
                {habits.slice(0, 4).map((h) => {
                  const freq = h.frequency ?? "daily";
                  const currentKey = currentPeriodKey(h);
                  const doneNow = !!h.completions[currentKey];
                  const periods = lastNPeriods(freq, 14);
                  const ctaShort = doneNow
                    ? "✓ feito"
                    : freq === "daily"
                      ? "marcar"
                      : freq === "weekly"
                        ? "esta sem."
                        : "este mês";
                  return (
                    <div key={h.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm">{h.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {FREQUENCY_LABEL[freq]}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleHabitPeriod(h.id, currentKey)}
                          className={`text-mono text-xs transition-colors ${
                            doneNow ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {ctaShort}
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {periods.map((p, i) => {
                          const filled = !!h.completions[p];
                          return (
                            <div
                              key={i}
                              className={`h-6 flex-1 rounded-sm transition-all ${
                                filled ? "bg-gradient-to-t from-primary to-primary-glow" : "bg-secondary/60"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-gradient-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl">Projetos</h2>
              <span className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {projects.length} ativo{projects.length !== 1 ? "s" : ""}
              </span>
            </div>
            {projects.length === 0 ? (
              <Link to="/projetos">
                <div className="rounded-xl border border-dashed border-border py-8 text-center hover:border-primary/40">
                  <p className="text-sm text-muted-foreground">Criar primeiro projeto</p>
                </div>
              </Link>
            ) : (
              <div className="space-y-3">
                {projects.slice(0, 4).map((p) => {
                  const total = p.tasks.length;
                  const done = p.tasks.filter((t) => t.done).length;
                  const pct = total ? Math.round((done / total) * 100) : 0;
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-border bg-background/40 p-3 transition-all hover:border-primary/40"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-primary" />
                        <p className="flex-1 text-sm font-medium truncate">{p.name}</p>
                        <span className="text-mono text-xs text-muted-foreground">
                          {done}/{total}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-secondary/60">
                        <div
                          className="h-full bg-gradient-primary transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
