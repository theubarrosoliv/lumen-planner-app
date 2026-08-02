import { useEffect, useMemo, useRef, useState } from "react";
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
const COMPACT_GUTTER_WIDTH = 28; // px — narrower gutter so 7 columns fit an iPhone with no drag
const DAY_COLUMN_MIN_WIDTH = 108; // px floor per day on roomy screens
const MAX_VISIBLE_UNTIMED = 2;
/** Below this viewport width the whole week is squeezed to fit with no
 * horizontal scroll — labels drop to just the time so 7 columns stay legible. */
const COMPACT_BREAKPOINT = 640;

const MONTH_ABBR = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// The app's signature gold (`--primary`), not the near-invisible neutral
// `border-border` — a hairline in that token all but disappears against this
// card's dark gradient background (both sit within a few % lightness of each
// other). Every structural line in the table — day columns, row groups, the
// hour ruler, the outer frame — shares this one accent for a single, obviously
// intentional grid instead of a patchwork of different divider treatments.
const DIVIDER = "border-primary/35";
const DIVIDER_SOFT = "border-primary/15";

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

  const [isCompact, setIsCompact] = useState(
    () => typeof window !== "undefined" && window.innerWidth < COMPACT_BREAKPOINT,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${COMPACT_BREAKPOINT - 1}px)`);
    const handler = () => setIsCompact(mq.matches);
    handler();
    // Both listeners target the same check — some environments (older
    // WebViews, devtools viewport overrides) resize without firing a
    // MediaQueryList "change" event, so the plain "resize" is a fallback.
    mq.addEventListener("change", handler);
    window.addEventListener("resize", handler);
    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);

  const gutterWidth = isCompact ? COMPACT_GUTTER_WIDTH : GUTTER_WIDTH;
  const columnMinWidth = isCompact ? undefined : DAY_COLUMN_MIN_WIDTH;

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
  // no-op once the compact layout makes every day fit with nothing to scroll.
  useEffect(() => {
    const container = hScrollRef.current;
    const target = container?.querySelector<HTMLElement>(`[data-day="${date}"]`);
    if (!container || !target) return;
    const contRect = container.getBoundingClientRect();
    const targRect = target.getBoundingClientRect();
    container.scrollLeft += targRect.left - contRect.left - (contRect.width - targRect.width) / 2;
  }, [date, isCompact]);

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
          className={cn("overflow-hidden rounded-lg border", DIVIDER)}
          style={{ minWidth: isCompact ? undefined : GUTTER_WIDTH + DAY_COLUMN_MIN_WIDTH * 7 }}
        >
          <div className={cn("flex divide-x border-b pb-2", DIVIDER)}>
            <div style={{ width: gutterWidth }} className="shrink-0" />
            {weekDates.map((dayKey, i) => {
              const isToday = dayKey === todayKey();
              const [, , d] = dayKey.split("-").map(Number);
              return (
                <div
                  key={dayKey}
                  data-day={dayKey}
                  className={cn("flex flex-1 flex-col items-center gap-1 py-0.5", laneTint(i, isToday))}
                  style={{ minWidth: columnMinWidth }}
                >
                  <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground sm:text-[10px] sm:tracking-[0.15em]">
                    {WEEKDAY_ABBR[i + 1]}
                  </span>
                  <span
                    className={cn(
                      "text-mono flex h-6 w-6 items-center justify-center rounded-full text-xs sm:h-7 sm:w-7 sm:text-sm",
                      isToday ? "bg-gradient-primary font-semibold text-primary-foreground" : "text-foreground",
                    )}
                  >
                    {String(d).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>

          <div className={cn("flex divide-x border-b py-2", DIVIDER)}>
            <div style={{ width: gutterWidth }} className="shrink-0" />
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
                  className={cn("flex flex-1 flex-col items-center gap-1 px-1 sm:items-stretch", laneTint(i, isToday))}
                  style={{ minWidth: columnMinWidth }}
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
                          "flex items-center gap-1 rounded-full border border-border text-[9px]",
                          isDone ? "text-muted-foreground line-through" : "bg-secondary/50",
                          isCompact ? "h-2.5 w-2.5 justify-center p-0" : "truncate px-1.5 py-0.5",
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
                        {!isCompact && <span className="truncate">{title}</span>}
                      </span>
                    );
                  })}
                  {hidden > 0 && (
                    <span className="px-1 text-[9px] text-muted-foreground">{isCompact ? `+${hidden}` : `+${hidden} mais`}</span>
                  )}
                </div>
              );
            })}
          </div>

          <div ref={vScrollRef} className="relative max-h-[60vh] overflow-y-auto">
            <div className="relative flex" style={{ height: 24 * HOUR_HEIGHT }}>
              <div className="relative shrink-0" style={{ width: gutterWidth }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <span
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-right text-[9px] text-muted-foreground/70 sm:right-2 sm:text-[10px]"
                    style={{ top: h * HOUR_HEIGHT }}
                  >
                    {isCompact ? h : `${String(h).padStart(2, "0")}h`}
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
                      className={cn("absolute inset-x-0 border-t", isHour ? DIVIDER : DIVIDER_SOFT)}
                      style={{ top: (minutes / 60) * HOUR_HEIGHT }}
                    />
                  );
                })}

                {byDay.map(({ dayKey, blocks }, i) => {
                  const isToday = dayKey === todayKey();
                  return (
                    <div
                      key={dayKey}
                      className={cn("relative flex-1 border-l", DIVIDER, laneTint(i, isToday))}
                      style={{ minWidth: columnMinWidth }}
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
                              {isCompact ? (
                                <span className="block truncate opacity-80">{t.time}</span>
                              ) : (
                                <>
                                  <span className="block truncate font-medium">{t.title}</span>
                                  <span className="block truncate opacity-80">{t.time}</span>
                                </>
                              )}
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
                            {isCompact ? (
                              e.time && <span className="block truncate opacity-80">{e.time}</span>
                            ) : (
                              <>
                                <span className="block truncate font-medium">{e.title}</span>
                                {e.time && <span className="block truncate opacity-80">{e.time}</span>}
                              </>
                            )}
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
