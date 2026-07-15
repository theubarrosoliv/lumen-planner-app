// Scans every user's data and sends due push notifications via FCM.
// Invoked on a schedule by pg_cron (see the fcm_push_setup migration) every
// 5 minutes. Can also be invoked manually to test before trusting the cron —
// see the plan's verification section.
//
// Required secrets (supabase secrets set ...):
//   FIREBASE_PROJECT_ID    - Firebase project id
//   FIREBASE_CLIENT_EMAIL  - service account client_email
//   FIREBASE_PRIVATE_KEY   - service account private_key (PEM, keep the \n's)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { periodKeyFor, streakOf, type HabitFrequency } from "./habits.ts";
import { getAccessToken, sendPush } from "./fcm.ts";

const DEFAULT_TIMEZONE = "America/Sao_Paulo";

type NotifyLeadUnit = "minutes" | "hours" | "days" | "weeks";

const LEAD_UNIT_MINUTES: Record<NotifyLeadUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
  weeks: 10080,
};

interface NotificationCategoryPrefs {
  taskReminder: boolean;
  dailyAgenda: boolean;
  eventReminder?: boolean; // optional: absent on prefs saved before this category existed
  habitReminder: boolean;
  habitStreakRisk: boolean;
  goalDeadline: boolean;
  milestoneDeadline: boolean;
  projectDeadline: boolean;
  projectTaskDeadline: boolean;
}

interface NotificationPrefs {
  enabled: boolean;
  timezone?: string;
  categories: NotificationCategoryPrefs;
  taskReminderMinutesBefore: number;
  dailyAgendaHour: number;
  habitReminderHour: number;
  habitStreakRiskHour: number;
  deadlineLeadDays: number[];
}

interface Candidate {
  kind: string;
  entityId: string;
  periodKey: string;
  title: string;
  body: string;
  link: string;
}

function localNow(timezone: string): Date {
  // Reinterprets "now" as if it were wall-clock time in `timezone`, so plain
  // Date getters (getHours, etc.) read as local time for that zone.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return new Date(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    Number(get("hour")) === 24 ? 0 : Number(get("hour")),
    Number(get("minute")),
    Number(get("second")),
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysUntil(deadline: string, today: Date): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const [y, m, d] = deadline.split("-").map(Number);
  const target = new Date(y, m - 1, d);
  return Math.round((target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86_400_000);
}

/** Midnight (00:00) of a "YYYY-MM-DD" string, or null if not a valid date. */
function startOfDay(dateStr: string | undefined): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0);
}

/** Converts a free-form per-item lead-time override into minutes, or null if unset. */
function leadMinutesFor(value: unknown, unit: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const mult = LEAD_UNIT_MINUTES[(unit as NotifyLeadUnit) ?? "minutes"] ?? 1;
  return value * mult;
}

/** True when `dueMoment` is in the future but within `leadMinutes` of `now`. */
function isWithinLeadWindow(dueMoment: Date, now: Date, leadMinutes: number): boolean {
  const minutesUntil = (dueMoment.getTime() - now.getTime()) / 60_000;
  return minutesUntil >= 0 && minutesUntil <= leadMinutes;
}

/** Start of the NEXT period boundary for a habit — the moment its current period ends. */
function periodEnd(freq: HabitFrequency, now: Date): Date {
  if (freq === "weekly") {
    const isoDay = now.getDay() || 7; // Mon=1..Sun=7
    const daysUntilNextMonday = 8 - isoDay;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilNextMonday, 0, 0, 0);
  }
  if (freq === "monthly") {
    return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
}

function fmtDatePt(dateStr: string): string {
  const d = startOfDay(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// deno-lint-ignore no-explicit-any
function computeCandidates(data: any, prefs: NotificationPrefs, now: Date): Candidate[] {
  const out: Candidate[] = [];
  const cats = prefs.categories;
  const today = dayKey(now);

  // ---- Tasks: lead time before the task's own date+time -------------------
  if (cats.taskReminder) {
    for (const t of data.tasks ?? []) {
      if (t.notify === false) continue;
      if (t.done || !t.time || t.time === "—" || !/^\d{2}:\d{2}$/.test(t.time)) continue;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t.date)) continue;
      const [ty, tm, td] = t.date.split("-").map(Number);
      const [hh, mm] = t.time.split(":").map(Number);
      const due = new Date(ty, tm - 1, td, hh, mm);
      const leadMinutes = leadMinutesFor(t.notifyLeadValue, t.notifyLeadUnit) ?? prefs.taskReminderMinutesBefore;
      if (isWithinLeadWindow(due, now, leadMinutes)) {
        out.push({
          kind: "task_upcoming",
          entityId: t.id,
          periodKey: t.date,
          title: `Em breve: ${t.title}`,
          body: `${fmtDatePt(t.date)} às ${t.time}${t.tag ? " · " + t.tag : ""}`,
          link: "/agenda",
        });
      }
    }
  }

  // ---- Daily agenda summary: unchanged, fires once at the configured hour -
  if (cats.dailyAgenda && now.getHours() === prefs.dailyAgendaHour) {
    const todays = (data.tasks ?? []).filter((t: any) => t.date === today && !t.done);
    if (todays.length > 0) {
      out.push({
        kind: "daily_agenda",
        entityId: "agenda",
        periodKey: today,
        title: "Sua agenda de hoje",
        body: `${todays.length} tarefa${todays.length === 1 ? "" : "s"}: ${todays
          .slice(0, 3)
          .map((t: any) => t.title)
          .join(", ")}${todays.length > 3 ? "..." : ""}`,
        link: "/agenda",
      });
    }
  }

  // ---- Events: lead time before start-of-day of the event's date ----------
  if (cats.eventReminder ?? true) {
    for (const ev of data.events ?? []) {
      if (ev.notify === false) continue;
      const dueDay = startOfDay(ev.date);
      if (!dueDay) continue;
      const override = leadMinutesFor(ev.notifyLeadValue, ev.notifyLeadUnit);
      if (override !== null) {
        if (isWithinLeadWindow(dueDay, now, override)) {
          out.push({
            kind: "event_reminder",
            entityId: ev.id,
            periodKey: ev.date,
            title: `Em breve: ${ev.title}`,
            body: fmtDatePt(ev.date),
            link: "/calendario",
          });
        }
      } else if (ev.date === today && now.getHours() === prefs.dailyAgendaHour) {
        out.push({
          kind: "event_reminder",
          entityId: ev.id,
          periodKey: ev.date,
          title: `Hoje: ${ev.title}`,
          body: "Evento marcado para hoje.",
          link: "/calendario",
        });
      }
    }
  }

  // ---- Habits: lead time before the current period's end, or old hour-based
  for (const h of data.habits ?? []) {
    if (h.notify === false) continue;
    const freq: HabitFrequency = h.frequency ?? "daily";
    const currentKey = periodKeyFor(freq, now);
    const completed = !!h.completions?.[currentKey];
    if (completed) continue;

    const override = leadMinutesFor(h.notifyLeadValue, h.notifyLeadUnit);
    const end = override !== null ? periodEnd(freq, now) : null;

    if (cats.habitReminder) {
      const due = override !== null && end
        ? isWithinLeadWindow(end, now, override)
        : now.getHours() === prefs.habitReminderHour;
      if (due) {
        out.push({
          kind: "habit_reminder",
          entityId: h.id,
          periodKey: currentKey,
          title: `Não esqueça: ${h.name}`,
          body: "Ainda não concluído neste período.",
          link: "/habitos",
        });
      }
    }

    if (cats.habitStreakRisk) {
      const streak = streakOf(h, now);
      if (streak >= 3) {
        const due = override !== null && end
          ? isWithinLeadWindow(end, now, override)
          : now.getHours() === prefs.habitStreakRiskHour;
        if (due) {
          out.push({
            kind: "habit_streak_risk",
            entityId: h.id,
            periodKey: currentKey,
            title: `Sua sequência de ${streak} dias está em risco!`,
            body: `Complete "${h.name}" antes do fim do período.`,
            link: "/habitos",
          });
        }
      }
    }
  }

  // ---- Goal/Milestone/Project/ProjectTask deadlines ------------------------
  // Per-item override: lead time before start-of-day of the deadline (fires
  // once total, dedup keyed by the deadline date itself). No override: the
  // original behavior — fires once per threshold in the global
  // deadlineLeadDays list (e.g. once at 3 days out, again at 1 day out),
  // dedup keyed by the day-count so both thresholds can each fire once.
  if (cats.goalDeadline) {
    for (const g of data.goals ?? []) {
      if (g.notify === false) continue;
      const dueDay = startOfDay(g.deadline);
      if (dueDay) {
        const override = leadMinutesFor(g.notifyLeadValue, g.notifyLeadUnit);
        const progress = `${(g.milestones ?? []).filter((m: any) => m.done).length} de ${(g.milestones ?? []).length} marcos concluídos`;
        if (override !== null) {
          if (isWithinLeadWindow(dueDay, now, override)) {
            out.push({
              kind: "goal_deadline",
              entityId: g.id,
              periodKey: g.deadline,
              title: `Meta "${g.name}" vence em breve`,
              body: progress,
              link: "/metas",
            });
          }
        } else {
          const du = daysUntil(g.deadline, now);
          if (du !== null && prefs.deadlineLeadDays.includes(du)) {
            out.push({
              kind: "goal_deadline",
              entityId: g.id,
              periodKey: `${du}d`,
              title: `Meta "${g.name}" vence em ${du} dia${du === 1 ? "" : "s"}`,
              body: progress,
              link: "/metas",
            });
          }
        }
      }

      if (cats.milestoneDeadline) {
        for (const m of g.milestones ?? []) {
          if (m.notify === false || m.done) continue;
          const mDueDay = startOfDay(m.deadline);
          if (!mDueDay) continue;
          const override = leadMinutesFor(m.notifyLeadValue, m.notifyLeadUnit);
          if (override !== null) {
            if (isWithinLeadWindow(mDueDay, now, override)) {
              out.push({
                kind: "milestone_deadline",
                entityId: m.id,
                periodKey: m.deadline!,
                title: `Marco "${m.name}" vence em breve`,
                body: `Meta: ${g.name}`,
                link: "/metas",
              });
            }
          } else {
            const mdu = daysUntil(m.deadline!, now);
            if (mdu !== null && prefs.deadlineLeadDays.includes(mdu)) {
              out.push({
                kind: "milestone_deadline",
                entityId: m.id,
                periodKey: `${mdu}d`,
                title: `Marco "${m.name}" vence em breve`,
                body: `Meta: ${g.name}`,
                link: "/metas",
              });
            }
          }
        }
      }
    }
  }

  if (cats.projectDeadline || cats.projectTaskDeadline) {
    for (const p of data.projects ?? []) {
      if (p.status !== "Concluído" && cats.projectDeadline && p.notify !== false) {
        const dueDay = startOfDay(p.deadline);
        if (dueDay) {
          const override = leadMinutesFor(p.notifyLeadValue, p.notifyLeadUnit);
          const done = (p.tasks ?? []).filter((t: any) => t.done).length;
          const body = `${done}/${(p.tasks ?? []).length} tarefas feitas`;
          if (override !== null) {
            if (isWithinLeadWindow(dueDay, now, override)) {
              out.push({
                kind: "project_deadline",
                entityId: p.id,
                periodKey: p.deadline,
                title: `Projeto "${p.name}" vence em breve`,
                body,
                link: "/projetos",
              });
            }
          } else {
            const du = daysUntil(p.deadline, now);
            if (du !== null && prefs.deadlineLeadDays.includes(du)) {
              out.push({
                kind: "project_deadline",
                entityId: p.id,
                periodKey: `${du}d`,
                title: `Projeto "${p.name}" vence em ${du} dia${du === 1 ? "" : "s"}`,
                body,
                link: "/projetos",
              });
            }
          }
        }
      }

      if (cats.projectTaskDeadline) {
        for (const t of p.tasks ?? []) {
          if (t.notify === false || t.done) continue;
          const tDueDay = startOfDay(t.deadline);
          if (!tDueDay) continue;
          const override = leadMinutesFor(t.notifyLeadValue, t.notifyLeadUnit);
          if (override !== null) {
            if (isWithinLeadWindow(tDueDay, now, override)) {
              out.push({
                kind: "project_task_deadline",
                entityId: t.id,
                periodKey: t.deadline!,
                title: `Tarefa "${t.title}" vence em breve`,
                body: `Projeto: ${p.name}`,
                link: "/projetos",
              });
            }
          } else {
            const tdu = daysUntil(t.deadline!, now);
            if (tdu !== null && prefs.deadlineLeadDays.includes(tdu)) {
              out.push({
                kind: "project_task_deadline",
                entityId: t.id,
                periodKey: `${tdu}d`,
                title: `Tarefa "${t.title}" vence em breve`,
                body: `Projeto: ${p.name}`,
                link: "/projetos",
              });
            }
          }
        }
      }
    }
  }

  return out;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID")!;
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL")!;
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")!.replace(/\\n/g, "\n");

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const [{ data: rows, error: rowsError }, { data: tokenRows, error: tokensError }] =
    await Promise.all([
      supabase.from("user_data").select("user_id, data"),
      supabase.from("fcm_tokens").select("id, user_id, token"),
    ]);

  if (rowsError || tokensError) {
    return new Response(
      JSON.stringify({ error: (rowsError ?? tokensError)?.message }),
      { status: 500 },
    );
  }

  const tokensByUser = new Map<string, { id: string; token: string }[]>();
  for (const t of tokenRows ?? []) {
    const list = tokensByUser.get(t.user_id) ?? [];
    list.push({ id: t.id, token: t.token });
    tokensByUser.set(t.user_id, list);
  }

  let sent = 0;
  let skipped = 0;
  const tokensToRemove: string[] = [];
  let accessToken: string | null = null;

  for (const row of rows ?? []) {
    const data = row.data ?? {};
    const prefs: NotificationPrefs | undefined = data.notificationPrefs;
    if (!prefs?.enabled) continue;

    const tokens = tokensByUser.get(row.user_id);
    if (!tokens || tokens.length === 0) continue;

    const now = localNow(prefs.timezone || DEFAULT_TIMEZONE);
    const candidates = computeCandidates(data, prefs, now);
    if (candidates.length === 0) continue;

    for (const c of candidates) {
      const { error: dedupeError } = await supabase
        .from("notification_log")
        .insert({ user_id: row.user_id, kind: c.kind, entity_id: c.entityId, period_key: c.periodKey });
      if (dedupeError) {
        // Unique violation => already sent this period; anything else, skip and move on.
        skipped++;
        continue;
      }

      accessToken ??= await getAccessToken({ clientEmail, privateKey, projectId });
      for (const t of tokens) {
        const result = await sendPush(accessToken, projectId, t.token, {
          title: c.title,
          body: c.body,
          link: c.link,
        });
        if (result.ok) sent++;
        else if (result.errorCode === "UNREGISTERED" || result.errorCode === "NOT_FOUND") {
          tokensToRemove.push(t.id);
        }
      }
    }
  }

  if (tokensToRemove.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", tokensToRemove);
  }

  return new Response(JSON.stringify({ sent, skipped, pruned: tokensToRemove.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
