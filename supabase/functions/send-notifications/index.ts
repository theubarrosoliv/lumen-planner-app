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

// deno-lint-ignore no-explicit-any
function computeCandidates(data: any, prefs: NotificationPrefs, now: Date): Candidate[] {
  const out: Candidate[] = [];
  const cats = prefs.categories;
  const today = dayKey(now);

  if (cats.taskReminder) {
    for (const t of data.tasks ?? []) {
      if (t.notify === false) continue;
      if (t.done || !t.time || t.time === "—" || !/^\d{2}:\d{2}$/.test(t.time)) continue;
      const [hh, mm] = t.time.split(":").map(Number);
      const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
      if (t.date !== today) continue;
      const minutesBefore =
        typeof t.notifyMinutesBefore === "number" ? t.notifyMinutesBefore : prefs.taskReminderMinutesBefore;
      const minutesUntil = (due.getTime() - now.getTime()) / 60_000;
      if (minutesUntil <= minutesBefore && minutesUntil >= 0) {
        out.push({
          kind: "task_upcoming",
          entityId: t.id,
          periodKey: t.date,
          title: `Em breve: ${t.title}`,
          body: `${t.time}${t.tag ? " · " + t.tag : ""}`,
          link: "/agenda",
        });
      }
    }
  }

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

  if ((cats.eventReminder ?? true) && now.getHours() === prefs.dailyAgendaHour) {
    for (const ev of data.events ?? []) {
      if (ev.notify === false) continue;
      if (ev.date !== today) continue;
      out.push({
        kind: "event_reminder",
        entityId: ev.id,
        periodKey: today,
        title: `Hoje: ${ev.title}`,
        body: "Evento marcado para hoje.",
        link: "/calendario",
      });
    }
  }

  for (const h of data.habits ?? []) {
    if (h.notify === false) continue;
    const freq: HabitFrequency = h.frequency ?? "daily";
    const currentKey = periodKeyFor(freq, now);
    const completed = !!h.completions?.[currentKey];
    if (completed) continue;

    if (cats.habitReminder && now.getHours() === prefs.habitReminderHour) {
      out.push({
        kind: "habit_reminder",
        entityId: h.id,
        periodKey: currentKey,
        title: `Não esqueça: ${h.name}`,
        body: "Ainda não concluído neste período.",
        link: "/habitos",
      });
    }

    if (cats.habitStreakRisk && now.getHours() === prefs.habitStreakRiskHour) {
      const streak = streakOf(h, now);
      if (streak >= 3) {
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

  // A per-item notifyDaysBefore override is a single day, so it's an exact
  // match (===) rather than the global deadlineLeadDays list membership.
  const isDeadlineDue = (du: number | null, notifyDaysBefore?: number) =>
    du !== null && (typeof notifyDaysBefore === "number" ? du === notifyDaysBefore : prefs.deadlineLeadDays.includes(du));

  if (cats.goalDeadline) {
    for (const g of data.goals ?? []) {
      const du = daysUntil(g.deadline, now);
      if (g.notify !== false && isDeadlineDue(du, g.notifyDaysBefore)) {
        out.push({
          kind: "goal_deadline",
          entityId: g.id,
          periodKey: `${du}d`,
          title: `Meta "${g.name}" vence em ${du} dia${du === 1 ? "" : "s"}`,
          body: `${(g.milestones ?? []).filter((m: any) => m.done).length} de ${(g.milestones ?? []).length} marcos concluídos`,
          link: "/metas",
        });
      }
      if (cats.milestoneDeadline) {
        for (const m of g.milestones ?? []) {
          if (m.notify === false || m.done || !m.deadline) continue;
          const mdu = daysUntil(m.deadline, now);
          if (isDeadlineDue(mdu, m.notifyDaysBefore)) {
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

  if (cats.projectDeadline || cats.projectTaskDeadline) {
    for (const p of data.projects ?? []) {
      if (p.status !== "Concluído" && cats.projectDeadline && p.notify !== false) {
        const du = daysUntil(p.deadline, now);
        if (isDeadlineDue(du, p.notifyDaysBefore)) {
          const done = (p.tasks ?? []).filter((t: any) => t.done).length;
          out.push({
            kind: "project_deadline",
            entityId: p.id,
            periodKey: `${du}d`,
            title: `Projeto "${p.name}" vence em ${du} dia${du === 1 ? "" : "s"}`,
            body: `${done}/${(p.tasks ?? []).length} tarefas feitas`,
            link: "/projetos",
          });
        }
      }
      if (cats.projectTaskDeadline) {
        for (const t of p.tasks ?? []) {
          if (t.notify === false || t.done || !t.deadline) continue;
          const tdu = daysUntil(t.deadline, now);
          if (isDeadlineDue(tdu, t.notifyDaysBefore)) {
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
