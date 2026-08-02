// Scans every user's data and sends due push notifications via FCM.
// Invoked on a schedule by pg_cron (see the fcm_push_setup migration) every
// minute — per-minute cadence is required so short lead times (e.g. "1 minuto
// antes") actually land instead of being stepped over between ticks. Can also
// be invoked manually to test before trusting the cron.
//
// Required secrets (supabase secrets set ...):
//   FIREBASE_PROJECT_ID    - Firebase project id
//   FIREBASE_CLIENT_EMAIL  - service account client_email
//   FIREBASE_PRIVATE_KEY   - service account private_key (PEM, keep the \n's)
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDueOn, periodEnd, periodKeyFor, streakOf, weekProgress, type HabitFrequency } from "./habits.ts";
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

// Small tolerance so a due moment that slips *between* cron ticks still fires
// once (the run reads `now` a few seconds after the tick, and a tick can be
// skipped/delayed). Without it, any lead window shorter than the gap between
// ticks could be stepped over entirely and never notify. Dedup guards repeats.
const NOTIFY_GRACE_MINUTES = 2;

/**
 * True when `now` is at/after the notify moment (`dueMoment` - lead) and not
 * more than the grace past `dueMoment`. Fires at the first tick inside the
 * window; the notification_log dedup then blocks any later tick in it.
 */
function isWithinLeadWindow(dueMoment: Date, now: Date, leadMinutes: number): boolean {
  const minutesUntil = (dueMoment.getTime() - now.getTime()) / 60_000;
  return minutesUntil >= -NOTIFY_GRACE_MINUTES && minutesUntil <= leadMinutes;
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

  // ---- Events: timed events fire relative to their date+time (like tasks);
  // all-day events keep the old start-of-day / agenda-hour behavior. --------
  if (cats.eventReminder ?? true) {
    for (const ev of data.events ?? []) {
      if (ev.notify === false) continue;
      const override = leadMinutesFor(ev.notifyLeadValue, ev.notifyLeadUnit);
      const hasTime = typeof ev.time === "string" && /^\d{2}:\d{2}$/.test(ev.time);

      if (hasTime) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date)) continue;
        const [ey, em, ed] = ev.date.split("-").map(Number);
        const [hh, mm] = ev.time.split(":").map(Number);
        const due = new Date(ey, em - 1, ed, hh, mm);
        const leadMinutes = override ?? prefs.taskReminderMinutesBefore;
        if (isWithinLeadWindow(due, now, leadMinutes)) {
          out.push({
            kind: "event_reminder",
            entityId: ev.id,
            periodKey: ev.date,
            title: `Em breve: ${ev.title}`,
            body: `${fmtDatePt(ev.date)} às ${ev.time}`,
            link: "/calendario",
          });
        }
        continue;
      }

      const dueDay = startOfDay(ev.date);
      if (!dueDay) continue;
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
    // "weekdays" habits are simply not due on off days — never nag then.
    if (!isDueOn(h, now)) continue;
    const currentKey = periodKeyFor(h, now);
    // "times_per_week" has no single boolean period — it's done once the
    // week's check-in target is met, regardless of which days were used.
    const completed =
      freq === "times_per_week"
        ? (() => {
            const wp = weekProgress(h, now);
            return wp.count >= wp.target;
          })()
        : !!h.completions?.[currentKey];
    if (completed) continue;

    const override = leadMinutesFor(h.notifyLeadValue, h.notifyLeadUnit);
    const end = override !== null ? periodEnd(h, now) : null;

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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Wrap the handler so an uncaught throw (e.g. getAccessToken failing on bad
// FCM service-account secrets) surfaces the actual message in the response
// body instead of an opaque platform 500 — makes the pipeline debuggable.
Deno.serve((_req) =>
  handler().catch((e) =>
    jsonResponse({ error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined }, 500),
  ),
);

async function handler(): Promise<Response> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const rawPrivateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["FIREBASE_PROJECT_ID", projectId],
    ["FIREBASE_CLIENT_EMAIL", clientEmail],
    ["FIREBASE_PRIVATE_KEY", rawPrivateKey],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    return jsonResponse({ error: `Secrets ausentes: ${missing.join(", ")}` }, 500);
  }
  const privateKey = rawPrivateKey!.replace(/\\n/g, "\n");

  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  const [{ data: rows, error: rowsError }, { data: tokenRows, error: tokensError }] =
    await Promise.all([
      supabase.from("user_data").select("user_id, data"),
      supabase.from("fcm_tokens").select("id, user_id, token"),
    ]);

  if (rowsError || tokensError) {
    return jsonResponse({ error: (rowsError ?? tokensError)?.message }, 500);
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
  const sendErrors: string[] = [];
  let accessToken: string | null = null;

  for (const row of rows ?? []) {
    const data = row.data ?? {};
    const prefs: NotificationPrefs | undefined = data.notificationPrefs;
    if (!prefs?.enabled) continue;

    const allTokens = tokensByUser.get(row.user_id);
    if (!allTokens || allTokens.length === 0) continue;
    // Dedupe by token value: the same device can leave multiple rows behind
    // (a rotated FCM token keeps the old row until it's pruned), and sending
    // to identical tokens would show the notification more than once.
    const seen = new Set<string>();
    const tokens = allTokens.filter((t) => (seen.has(t.token) ? false : (seen.add(t.token), true)));

    const now = localNow(prefs.timezone || DEFAULT_TIMEZONE);
    const candidates = computeCandidates(data, prefs, now);
    if (candidates.length === 0) continue;

    for (const c of candidates) {
      // Mint the FCM token BEFORE claiming the dedup row: if the service
      // account is misconfigured this throws (→ 500, visible in logs) without
      // leaving behind an "already sent" row that would permanently suppress
      // this notification.
      accessToken ??= await getAccessToken({ clientEmail, privateKey, projectId });

      const dedupeRow = {
        user_id: row.user_id,
        kind: c.kind,
        entity_id: c.entityId,
        period_key: c.periodKey,
      };
      const { error: dedupeError } = await supabase.from("notification_log").insert(dedupeRow);
      if (dedupeError) {
        // Unique violation => already sent this period; anything else, skip and move on.
        skipped++;
        continue;
      }

      let delivered = false;
      for (const t of tokens) {
        const result = await sendPush(accessToken, projectId, t.token, {
          title: c.title,
          body: c.body,
          link: c.link,
        });
        if (result.ok) {
          sent++;
          delivered = true;
        } else if (result.errorCode === "UNREGISTERED" || result.errorCode === "NOT_FOUND") {
          tokensToRemove.push(t.id);
        } else if (sendErrors.length < 5) {
          sendErrors.push(`${result.errorCode}${result.errorMessage ? ": " + result.errorMessage : ""}`);
        }
      }

      // Nothing was actually delivered (e.g. transient FCM failure) — release
      // the dedup claim so the next tick retries instead of swallowing it.
      if (!delivered) {
        await supabase.from("notification_log").delete().match(dedupeRow);
        skipped++;
      }
    }
  }

  if (tokensToRemove.length > 0) {
    await supabase.from("fcm_tokens").delete().in("id", tokensToRemove);
  }

  return jsonResponse({ sent, skipped, pruned: tokensToRemove.length, sendErrors });
}
