import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
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
const DAY_COLUMN_MIN_WIDTH = 108; // px floor per day before the week scrolls horizontally
const MAX_VISIBLE_UNTIMED = 2;

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

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

/**
 * A fixed, Google Calendar–style week grid: every day of the week (Mon–Sun)
 * side by side, sharing one hour ruler, so times line up across the whole
 * week instead of showing one day at a time. `date` is just an anchor —
 * any day within the week to display — not a "selected day".
 */
export function ScheduleView({
  date,
  onDateChange,
  tasks,
  events,
  onToggleTask,
  renderEventTrigger,
}: {
  date: string;
  onDateChange: (key: string) => void;
  tasks: Task[];
  events: CalEvent[];
  onToggleTask: (id: string) => void;
  /** Lets the caller wrap each event block in its own edit dialog (Calendar.tsx owns EventDialog). */
  renderEventTrigger: (event: CalEvent, block: React.ReactNode) => React.ReactNode;
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

  // Auto-scroll the week horizontally so the anchor day is in view — a
  // no-op on desktop (the week already fits), useful on narrow screens.
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
    <div className="rounded-2xl border border-border bg-gradient-card p-4 md:p-6">
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

      <div ref={hScrollRef} className="overflow-x-auto">
        <div style={{ minWidth: GUTTER_WIDTH + DAY_COLUMN_MIN_WIDTH * 7 }}>
          <div className="flex border-b border-border pb-2">
            <div style={{ width: GUTTER_WIDTH }} className="shrink-0" />
            {weekDates.map((dayKey, i) => {
              const isToday = dayKey === todayKey();
              const [, , d] = dayKey.split("-").map(Number);
              return (
                <div
                  key={dayKey}
                  data-day={dayKey}
                  className="flex flex-1 flex-col items-center gap-1"
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

          <div className="flex border-b border-border py-2">
            <div style={{ width: GUTTER_WIDTH }} className="shrink-0" />
            {byDay.map(({ dayKey, untimedTasks, untimedEvents }) => {
              const untimed = [
                ...untimedEvents.map((e) => ({ kind: "event" as const, event: e })),
                ...untimedTasks.map((t) => ({ kind: "task" as const, task: t })),
              ];
              const visible = untimed.slice(0, MAX_VISIBLE_UNTIMED);
              const hidden = untimed.length - visible.length;
              return (
                <div key={dayKey} className="flex flex-1 flex-col gap-1 px-1" style={{ minWidth: DAY_COLUMN_MIN_WIDTH }}>
                  {visible.map((item) =>
                    item.kind === "event" ? (
                      renderEventTrigger(
                        item.event,
                        <span
                          key={item.event.id}
                          className="flex cursor-pointer items-center gap-1 truncate rounded-full border border-border bg-secondary/50 px-1.5 py-0.5 text-[9px]"
                        >
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.event.color)} />
                          <span className="truncate">{item.event.title}</span>
                        </span>,
                      )
                    ) : (
                      <button
                        key={item.task.id}
                        onClick={() => onToggleTask(item.task.id)}
                        className={cn(
                          "flex items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-[9px] transition-colors",
                          item.task.done ? "border-border text-muted-foreground line-through" : "border-border bg-secondary/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-2.5 w-2.5 shrink-0 items-center justify-center rounded-full border",
                            item.task.done ? "border-primary bg-gradient-primary" : "border-border",
                          )}
                        >
                          {item.task.done && <Check className="h-1.5 w-1.5 text-primary-foreground" />}
                        </span>
                        <span className="truncate">{item.task.title}</span>
                      </button>
                    ),
                  )}
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
                    {String(h).padStart(2, "0")}h
                  </span>
                ))}
              </div>

              <div className="relative flex flex-1">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: h * HOUR_HEIGHT }} />
                ))}

                {byDay.map(({ dayKey, blocks }) => {
                  const isToday = dayKey === todayKey();
                  return (
                    <div
                      key={dayKey}
                      className="relative flex-1 border-l border-border/40 first:border-l-0"
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
                            <button
                              key={b.id}
                              onClick={() => onToggleTask(t.id)}
                              style={style}
                              className={cn(
                                "absolute z-10 overflow-hidden rounded-md border px-1.5 py-1 text-left text-[10px] transition-opacity",
                                t.done
                                  ? "border-border bg-secondary/40 text-muted-foreground line-through opacity-70"
                                  : t.priority
                                    ? PRIORITY_BLOCK_STYLE[t.priority]
                                    : "border-border bg-secondary/60",
                              )}
                            >
                              <span className="block truncate font-medium">{t.title}</span>
                              <span className="block truncate opacity-80">{t.time}</span>
                            </button>
                          );
                        }

                        const e = b.event;
                        return renderEventTrigger(
                          e,
                          <button
                            key={b.id}
                            style={style}
                            className="absolute z-10 overflow-hidden rounded-md border border-border/70 bg-secondary/60 px-1.5 py-1 text-left text-[10px]"
                          >
                            <span className={cn("mb-0.5 block h-1 w-4 rounded-full", e.color)} />
                            <span className="block truncate font-medium">{e.title}</span>
                            {e.time && <span className="block truncate opacity-80">{e.time}</span>}
                          </button>,
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
