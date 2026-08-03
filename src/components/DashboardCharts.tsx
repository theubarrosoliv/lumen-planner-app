import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useUserData } from "@/store/useAppStore";
import { HabitFrequency, LifeDomain } from "@/store/types";
import { FREQUENCY_LABEL, lastNPeriods, streakOf } from "@/lib/habits";
import { resolveDomain } from "@/lib/domain";
import { TrendingUp, Flame, Target, Layers } from "lucide-react";

// Only the three calendar-uniform kinds are offered as tabs here — the
// custom kinds (weekdays/every_n_days/times_per_week) are configured
// per-habit (different weekday sets, intervals, targets), so there's no
// single shared period axis to compare them on in one trend chart. Their
// streaks still show up in the "Streaks atuais" chart below, which is
// per-habit and has no such constraint.
const TREND_FREQUENCIES: HabitFrequency[] = ["daily", "weekly", "monthly"];

const PERIODS_BY_FREQ: Partial<Record<HabitFrequency, number>> = {
  daily: 14,
  weekly: 12,
  monthly: 12,
};

function formatPeriodLabel(freq: HabitFrequency, key: string): string {
  if (freq === "weekly") {
    const w = key.split("-W")[1];
    return `S${w}`;
  }
  if (freq === "monthly") {
    const [, m] = key.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return months[Number(m) - 1] ?? key;
  }
  // daily (and, if ever routed here, weekdays/every_n_days/times_per_week —
  // all use a "YYYY-MM-DD"-shaped key)
  const parts = key.split("-");
  return `${parts[2]}/${parts[1]}`;
}

function ChartCard({
  title,
  hint,
  icon,
  children,
  empty,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-primary-glow">{icon}</span>
          <h3 className="font-display text-lg">{title}</h3>
        </div>
        {hint ? (
          <span className="text-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </div>
      {empty ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          Sem dados ainda
        </div>
      ) : (
        children
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--popover-foreground))",
};

export function HabitsCharts() {
  const { habits } = useUserData();
  const [freq, setFreq] = useState<HabitFrequency>("daily");

  const habitsTrend = useMemo(() => {
    const matching = habits.filter((h) => (h.frequency ?? "daily") === freq);
    const periods = lastNPeriods({ frequency: freq }, PERIODS_BY_FREQ[freq] ?? 12);
    return periods.map((p) => ({
      period: formatPeriodLabel(freq, p),
      done: matching.reduce((acc, h) => acc + (h.completions[p] ? 1 : 0), 0),
      total: matching.length,
    }));
  }, [habits, freq]);

  const streakData = useMemo(
    () =>
      habits
        .map((h) => ({ name: h.name, streak: streakOf(h) }))
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 6),
    [habits],
  );

  const matchingCount = habits.filter((h) => (h.frequency ?? "daily") === freq).length;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Habits trend */}
      <ChartCard
        title="Tendência de hábitos"
        hint={`${matchingCount} ${FREQUENCY_LABEL[freq].toLowerCase()}${matchingCount !== 1 ? "s" : ""}`}
        icon={<TrendingUp className="h-4 w-4" />}
        empty={habits.length === 0}
      >
        <div className="mb-3 flex gap-1">
          {TREND_FREQUENCIES.map((f) => (
            <button
              key={f}
              onClick={() => setFreq(f)}
              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wider transition-colors ${
                freq === f
                  ? "border-primary/60 bg-primary/15 text-primary-glow"
                  : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              {FREQUENCY_LABEL[f]}
            </button>
          ))}
        </div>
        <div className="h-40 md:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={habitsTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="habitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.55} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
                formatter={(v: number, _n, p) => [`${v}/${p.payload.total}`, "Concluídos"]}
              />
              <Area
                type="monotone"
                dataKey="done"
                stroke="hsl(var(--primary-glow))"
                strokeWidth={2}
                fill="url(#habitFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      {/* Streaks */}
      <ChartCard
        title="Streaks atuais"
        hint={`top ${streakData.length}`}
        icon={<Flame className="h-4 w-4" />}
        empty={streakData.length === 0}
      >
        <div className="h-40 md:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={streakData}
              layout="vertical"
              margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
            >
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "hsl(var(--secondary))", fillOpacity: 0.4 }}
                formatter={(v: number) => [`${v}`, "Streak"]}
              />
              <Bar dataKey="streak" radius={[0, 6, 6, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

    </div>
  );
}

export function GoalsCharts({ domain }: { domain?: LifeDomain } = {}) {
  const { goals: allGoals } = useUserData();
  const goals = domain ? allGoals.filter((g) => resolveDomain(g) === domain) : allGoals;
  const goalData = useMemo(
    () =>
      goals.map((g) => {
        const total = g.milestones.length || 1;
        const done = g.milestones.filter((m) => m.done).length;
        return { name: g.name, pct: Math.round((done / total) * 100) };
      }),
    [goals],
  );

  return (
    <ChartCard
      title="Progresso de metas"
      hint={`${goals.length} meta${goals.length !== 1 ? "s" : ""}`}
      icon={<Target className="h-4 w-4" />}
      empty={goalData.length === 0}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={goalData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "hsl(var(--secondary))", fillOpacity: 0.4 }}
              formatter={(v: number) => [`${v}%`, "Progresso"]}
            />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
              {goalData.map((g, i) => (
                <Cell key={i} fill={g.pct >= 100 ? "hsl(var(--success))" : "hsl(var(--primary))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function ProjectsCharts({ domain }: { domain?: LifeDomain } = {}) {
  const { projects: allProjects } = useUserData();
  const projects = domain ? allProjects.filter((p) => resolveDomain(p) === domain) : allProjects;
  const projectData = useMemo(
    () =>
      projects.map((p) => {
        const total = p.tasks.length || 1;
        const done = p.tasks.filter((t) => t.done).length;
        return { name: p.name, pct: Math.round((done / total) * 100) };
      }),
    [projects],
  );

  return (
    <ChartCard
      title="Progresso de projetos"
      hint={`${projects.length} projeto${projects.length !== 1 ? "s" : ""}`}
      icon={<Layers className="h-4 w-4" />}
      empty={projectData.length === 0}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={projectData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={88}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              cursor={{ fill: "hsl(var(--secondary))", fillOpacity: 0.4 }}
              formatter={(v: number) => [`${v}%`, "Progresso"]}
            />
            <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
              {projectData.map((p, i) => (
                <Cell key={i} fill={p.pct >= 100 ? "hsl(var(--success))" : "hsl(var(--primary-glow))"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

