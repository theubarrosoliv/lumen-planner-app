import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task, CalEvent } from "@/store/types";
import { dateKey, todayKey } from "@/store/useAppStore";
import { timeToMinutes, layoutTimeline } from "@/lib/timeline";
import { PRIORITY_BLOCK_STYLE } from "@/lib/priority";
import { isoWeekday, WEEKDAY_ABBR } from "@/lib/date";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 56; // px per hour
const DEFAULT_TASK_DURATION = 30; // minutes, when the task has none set
const DEFAULT_EVENT_DURATION = 60;
const MIN_BLOCK_HEIGHT = 26; // px — keeps very short/zero-duration blocks tappable
const GUTTER_WIDTH = 48; // px — width of the shared hour-label column
const DAY_COLUMN_MIN_WIDTH = 108; // px floor per day — the week scrolls horizontally below this
const MAX_VISIBLE_UNTIMED = 2;

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// The app's signature gold, reserved for the two things that actually read as
// "table structure": the vertical lines separating one day from the next,
// and the frame around the whole table. Horizontal rules (row groups, the
// hour ruler) stay neutral so the gold doesn't turn into visual noise.
// `divide-*` needs its own explicit color utility — a `border-{color}` class
// on the row only colors that row's own border sides (e.g. `border-b`), not
// the hairlines `divide-x` draws between its children.
const DIVIDER_GOLD = "border-primary/35";
const DIVIDE_GOLD = "divide-primary/35";
const DIVIDER_NEUTRAL = "border-muted-foreground/25";
const DIVIDER_NEUTRAL_SOFT = "border-muted-foreground/10";

function shiftDate(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + deltaDays));
}

/** Monday (ISO week start) of the week containing `key`. */
function mondayOf(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const iso = isoWeekday(new Date(y, m - 1, d));
  return dateKey(new Date(y, m - 1, d - (iso - 1)));
}

function formatWeekRange(weekDates: string[]): string {
  const fmt = (key: string) => {
    const [, m, d] = key.split("-").map(Number);
    return `${d} ${MONTH_ABBR[m - 1]}`;
  };
  return `${fmt(weekDates[0])} – ${fmt(weekDates[6])}`;
}

/** Alternating day "lanes" (plus a distinct tint for today) so a column's
 * boundaries stay obvious even where the divider line itself is faint. */
function laneTint(index: number, isToday: boolean): string {
  if (isToday) return "bg-primary/10";
  return index % 2 === 1 ? "bg-muted-foreground/[0.04]" : "";
}

/**
 * A fixed, Google Calendar–style week grid: every day of the week (Mon–Sun)
 * side by side, sharing one hour ruler, so times line up across the whole
 * week instead of showing one day at a time. `date` is just an anchor — any
 * day within the week to display — not a "selected day". Purely a read-only
 * viewer: nothing here can be edited, completed, or deleted — that happens
 * in the actual task/habit/event screens — this is just a picture of the week.
 */
export function ScheduleView({
  date,
  onDateChange,
  tasks,
  events,
}: {
  date: string;
  onDateChange: (key: string) => void;
  tasks: Task[];
  events: CalEvent[];
}) {
  const vScrollRef = useRef<HTMLDivElement>(null);
  const hScrollRef = useRef<HTMLDivElement>(null);

  const weekDates = useMemo(() => {
    const start = mondayOf(date);
    const [y, m, d] = start.split("-").map(Number);
    return Array.from({ length: 7 }, (_, i) => dateKey(new Date(y, m - 1, d + i)));
  }, [date]);
  const weekStart = weekDates[0];
  const containsToday = weekDates.includes(todayKey());

  const byDay = useMemo(
    () =>
      weekDates.map((dayKey) => {
        const dayTasks = tasks.filter((t) => t.date === dayKey);
        const dayEvents = events.filter((e) => e.date === dayKey);
        const untimedTasks = dayTasks.filter((t) => timeToMinutes(t.time) === null);
        const untimedEvents = dayEvents.filter((e) => timeToMinutes(e.time) === null);
        const taskBlocks = dayTasks
          .filter((t) => timeToMinutes(t.time) !== null)
          .map((t) => {
            const start = timeToMinutes(t.time)!;
            return { id: `task-${t.id}`, start, end: start + (t.duration ?? DEFAULT_TASK_DURATION), kind: "task" as const, task: t };
          });
        const eventBlocks = dayEvents
          .filter((e) => timeToMinutes(e.time) !== null)
          .map((e) => {
            const start = timeToMinutes(e.time)!;
            return { id: `event-${e.id}`, start, end: start + (e.duration ?? DEFAULT_EVENT_DURATION), kind: "event" as const, event: e };
          });
        return { dayKey, untimedTasks, untimedEvents, blocks: layoutTimeline([...taskBlocks, ...eventBlocks]) };
      }),
    [weekDates, tasks, events],
  );

  // Auto-scroll the hour grid: to ~2h before now if this week contains
  // today, otherwise to a sensible 8am default — only re-runs when the
  // displayed week actually changes, not on every render.
  useEffect(() => {
    if (!vScrollRef.current) return;
    const now = new Date();
    const targetMinutes = containsToday ? now.getHours() * 60 + now.getMinutes() - 120 : 8 * 60;
    vScrollRef.current.scrollTop = Math.max(0, (targetMinutes / 60) * HOUR_HEIGHT);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  // Auto-scroll the week horizontally so the anchor day is in view on
  // narrow screens, where the week doesn't fully fit.
  useEffect(() => {
    const container = hScrollRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-day="${date}"]`);
    if (!container || !target) return;
    const contRect = container.getBoundingClientRect();
    const targRect = target.getBoundingClientRect();
    container.scrollLeft += targRect.left - contRect.left - (contRect.width - targRect.width) / 2;
  }, [date]);

  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-gradient-card p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl md:text-2xl" aria-live="polite">
          {formatWeekRange(weekDates)}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onDateChange(shiftDate(date, -7))} aria-label="Semana anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDateChange(todayKey())}>
            Esta semana
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDateChange(shiftDate(date, 7))} aria-label="Próxima semana">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={hScrollRef} className="min-w-0 overflow-x-auto">
        <div
          className={cn("overflow-hidden rounded-lg border", DIVIDER_GOLD)}
          style={{ minWidth: GUTTER_WIDTH + DAY_COLUMN_MIN_WIDTH * 7 }}
        >
          <div className={cn("flex divide-x border-b pb-2", DIVIDE_GOLD, DIVIDER_NEUTRAL)}>
            <div style={{ width: GUTTER_WIDTH }} className="shrink-0" />
            {weekDates.map((dayKey, i) => {
              const isToday = dayKey === todayKey();
              const [, , d] = dayKey.split("-").map(Number);
              return (
                <div
                  key={dayKey}
                  data-day={dayKey}
                  className={cn("flex flex-1 flex-col items-center gap-1", laneTint(i, isToday))}
                  style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
                >
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    {WEEKDAY_ABBR[i + 1]}
                  </span>
                  <span
                    className={cn(
                      "text-mono flex h-7 w-7 items-center justify-center rounded-full text-sm",
                      isToday ? "bg-gradient-primary font-semibold text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {String(d).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={cn("flex divide-x border-b py-2", DIVIDE_GOLD, DIVIDER_NEUTRAL)}>
            <div style={{ width: GUTTER_WIDTH }} className="shrink-0" />
            {byDay.map(({ dayKey, untimedTasks, untimedEvents }, i) => {
              const isToday = dayKey === todayKey();
              const untimed = [
                ...untimedEvents.map((e) => ({ kind: "event" as const, event: e })),
                ...untimedTasks.map((t) => ({ kind: "task" as const, task: t })),
              ];
              const visible = untimed.slice(0, MAX_VISIBLE_UNTIMED);
              const hidden = untimed.length - visible.length;
              return (
                <div
                  key={dayKey}
                  className={cn("flex flex-1 flex-col gap-1 px-1", laneTint(i, isToday))}
                  style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
                >
                  {visible.map((item) => {
                    const isDone = item.kind === "task" && item.task.done;
                    const title = item.kind === "event" ? item.event.title : item.task.title;
                    const dotColor =
                      item.kind === "event" ? item.event.color : isDone ? "bg-success" : "bg-muted-foreground/60";
                    return (
                      <span
                        key={item.kind === "event" ? item.event.id : item.task.id}
                        title={title}
                        className={cn(
                          "flex items-center gap-1 truncate rounded-full border border-border px-1.5 py-0.5 text-[9px]",
                          isDone ? "text-muted-foreground line-through" : "bg-secondary/50",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
                        <span className="truncate">{title}</span>
                      </span>
                    );
                  })}
                  {hidden > 0 && <span className="px-1 text-[9px] text-muted-foreground">+{hidden} mais</span>}
                </div>
              );
            })}
          </div>

          <div ref={vScrollRef} className="relative max-h-[60vh] overflow-y-auto">
            <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
              <div className="relative shrink-0" style={{ width: GUTTER_WIDTH }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="absolute right-2 -translate-y-1/2 text-right text-[10px] text-muted-foreground/70"
                    style={{ top: h * HOUR_HEIGHT }}
                  >
                    {String(h).padStart(2, "0")}:00
                  </span>
                ))}
              </div>

              <div className="relative flex flex-1">
                {Array.from({ length: 48 }, (_, i) => {
                  const minutes = i * 30;
                  const isHour = minutes % 60 === 0;
                  return (
                    <div
                      key={i}
                      className={cn("absolute inset-x-0 border-t", isHour ? DIVIDER_NEUTRAL : DIVIDER_NEUTRAL_SOFT)}
                      style={{ top: (minutes / 60) * HOUR_HEIGHT }}
                    />
                  );
                })}

                {byDay.map(({ dayKey, blocks }, i) => {
                  const isToday = dayKey === todayKey();
                  return (
                    <div
                      key={dayKey}
                      className={cn("relative flex-1 border-l", DIVIDER_GOLD, laneTint(i, isToday))}
                      style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}
                    >
                      {isToday && (
                        <div
                          className="absolute inset-x-0 z-20 flex items-center"
                          style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
                        >
                          <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                          <div className="h-px flex-1 bg-destructive/70" />
                        </div>
                      )}
                      {blocks.map((b) => {
                        const top = (b.start / 60) * HOUR_HEIGHT;
                        const height = Math.max(MIN_BLOCK_HEIGHT, ((b.end - b.start) / 60) * HOUR_HEIGHT);
                        const widthPct = 100 / b.cols;
                        const style = {
                          top,
                          height,
                          left: `${b.col * widthPct}%`,
                          width: `calc(${widthPct}% - 3px)`,
                        };

                        if (b.kind === "task") {
                          const t = b.task;
                          return (
                            <div
                              key={b.id}
                              title={t.title}
                              style={style}
                              className={cn(
                                "absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[10px]",
                                t.done
                                  ? "border-border bg-secondary/40 text-muted-foreground line-through opacity-70"
                                  : t.priority
                                    ? PRIORITY_BLOCK_STYLE[t.priority]
                                    : "border-border bg-secondary/60",
                              )}
                            >
                              <span className="block truncate font-medium">{t.title}</span>
                              <span className="block truncate opacity-80">{t.time}</span>
                            </div>
                          );
                        }

                        const e = b.event;
                        return (
                          <div
                            key={b.id}
                            style={style}
                            title={e.title}
                            className="absolute z-10 overflow-hidden rounded-md border border-border/70 bg-secondary/60 px-1.5 py-1 text-left text-[10px]"
                          >
                            <span className={cn("mb-0.5 block h-1 w-4 rounded-full", e.color)} />
                            <span className="block truncate font-medium">{e.title}</span>
                            {e.time && <span className="block truncate opacity-80">{e.time}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
