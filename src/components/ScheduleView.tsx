import { Fragment, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Task, CalEvent } from "@/store/types";
import { dateKey, todayKey } from "@/store/useAppStore";
import { timeToMinutes, layoutTimeline, minutesToTime } from "@/lib/timeline";
import { PRIORITY_ACCENT, PRIORITY_BORDER, PRIORITY_TINT } from "@/lib/priority";
import { itemTags } from "@/lib/tags";
import { firstTagStyle } from "@/lib/tagColors";
import { isoWeekday, WEEKDAY_ABBR } from "@/lib/date";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 64; // px per hour
const DEFAULT_TASK_DURATION = 30; // minutes, when the task has none set
const DEFAULT_EVENT_DURATION = 60;
const MIN_BLOCK_HEIGHT = 30; // px — keeps very short/zero-duration blocks tappable
/** Below this height a block only has room for one line, so title and time
 * share it instead of being stacked (and clipped). */
const COMPACT_BLOCK_HEIGHT = 44;
const GUTTER_WIDTH = 48; // px — width of the shared hour-label column
const DAY_COLUMN_MIN_WIDTH = 108; // px floor per day — the week scrolls horizontally below this
/** Breathing room on each side of a block, so blocks never touch the gold day
 * dividers (or each other when side by side) and every one reads as its own card. */
const BLOCK_INSET = 3;
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

const hasTime = (time?: string) => !!time && time !== "—";

/** Hover/long-press text: everything that doesn't fit inside a small block. */
function blockTooltip(title: string, when?: string | null, tags?: string[]): string {
  return [when ? `${when} · ${title}` : title, tags?.length ? tags.join(", ") : null]
    .filter(Boolean)
    .join("\n");
}

/**
 * "15:00 – 16:30" when the item has an explicit end, just "15:00" when it
 * doesn't. Deliberately NOT derived from the block's laid-out height: that
 * height falls back to a default length for items with no duration, so
 * reading the end off it would state an end time the user never set.
 */
function timeRange(time: string | undefined, duration: number | undefined, endMinutes: number): string | null {
  if (!hasTime(time)) return null;
  return duration ? `${time} – ${minutesToTime(endMinutes)}` : time!;
}

/**
 * How a task block is colored: a stripe down its left edge, a wash over its
 * whole face, and the outline.
 *
 * The TAG owns the color, since telling two tasks apart in a crowded day is
 * exactly what tags are for. Priority still shows through the outline, so a
 * tagged high-priority task carries both signals instead of one overwriting
 * the other; a task with a priority and no tag is colored by the priority
 * instead.
 *
 * An untagged, unprioritized task keeps the app's gold, so a plain task still
 * looks like it belongs to Lumen instead of going grey. It gets the stripe
 * and outline but NOT the full-face wash — that's what keeps tagged tasks
 * standing out against the untagged ones, which are the majority.
 */
function taskAccent(t: Task): { stripe: string; border: string; tint: string } {
  if (t.done) return { stripe: "bg-muted-foreground/40", border: "border-border", tint: "" };
  const tag = firstTagStyle(itemTags(t));
  const priority = t.priority
    ? {
        stripe: PRIORITY_ACCENT[t.priority],
        border: PRIORITY_BORDER[t.priority],
        tint: PRIORITY_TINT[t.priority],
      }
    : null;
  return {
    stripe: tag?.accent ?? priority?.stripe ?? "bg-primary",
    border: priority?.border ?? tag?.border ?? "border-primary/40",
    tint: tag?.tint ?? priority?.tint ?? "",
  };
}

/**
 * A fixed, Google Calendar–style week grid: every day of the week (Mon–Sun)
 * side by side, sharing one hour ruler, so times line up across the whole
 * week instead of showing one day at a time. `date` is just an anchor — any
 * day within the week to display — not a "selected day".
 *
 * Nothing can be completed, toggled or deleted from here — this stays a
 * picture of the week, so a stray tap can never change your data. Tapping a
 * block instead OPENS that item's own dialog (via `renderTaskTrigger` /
 * `renderEventTrigger`) to read it in full or edit it deliberately; without
 * those props the blocks are inert.
 */
export function ScheduleView({
  date,
  onDateChange,
  tasks,
  events,
  renderTaskTrigger,
  renderEventTrigger,
}: {
  date: string;
  onDateChange: (key: string) => void;
  tasks: Task[];
  events: CalEvent[];
  renderTaskTrigger?: (task: Task, trigger: React.ReactElement) => React.ReactNode;
  renderEventTrigger?: (event: CalEvent, trigger: React.ReactElement) => React.ReactNode;
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
                    const isTask = item.kind === "task";
                    const source = isTask ? item.task : item.event;
                    const isDone = isTask && item.task.done;
                    const stripe = isTask ? taskAccent(item.task).stripe : item.event.color;
                    const render = isTask ? renderTaskTrigger : renderEventTrigger;

                    const pillClass = cn(
                      "flex w-full items-center gap-1 truncate rounded-full border px-1.5 py-0.5 text-left text-[9px]",
                      isDone
                        ? "border-border text-muted-foreground line-through"
                        : "border-border bg-card font-medium",
                      render && "transition-colors hover:border-primary/60",
                    );
                    const pillTitle = blockTooltip(source.title, null, itemTags(source));
                    const pillContent = (
                      <>
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", stripe)} />
                        <span className="truncate">{source.title}</span>
                      </>
                    );
                    const pill = render ? (
                      <button
                        type="button"
                        title={pillTitle}
                        aria-label={`Abrir ${isTask ? "tarefa" : "evento"} "${source.title}"`}
                        className={pillClass}
                      >
                        {pillContent}
                      </button>
                    ) : (
                      <span title={pillTitle} className={pillClass}>
                        {pillContent}
                      </span>
                    );

                    return (
                      <Fragment key={source.id}>
                        {isTask && renderTaskTrigger
                          ? renderTaskTrigger(item.task, pill)
                          : !isTask && renderEventTrigger
                            ? renderEventTrigger(item.event, pill)
                            : pill}
                      </Fragment>
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
                          left: `calc(${b.col * widthPct}% + ${BLOCK_INSET}px)`,
                          width: `calc(${widthPct}% - ${BLOCK_INSET * 2}px)`,
                        };
                        const compact = height < COMPACT_BLOCK_HEIGHT;

                        const isTask = b.kind === "task";
                        const source = isTask ? b.task : b.event;
                        const isDone = isTask && b.task.done;
                        // Events keep the stripe-only treatment: their color
                        // is a free-form bg-* class the user picked, so there
                        // is no matching translucent variant to wash with.
                        const { stripe, border, tint } = isTask
                          ? taskAccent(b.task)
                          : { stripe: b.event.color, border: "border-border", tint: "" };

                        // Opaque `bg-card` on purpose: the old translucent fill
                        // let the day-lane tint bleed through, which made two
                        // adjacent blocks read as one shaded area.
                        const blockClass = cn(
                          "absolute z-10 flex overflow-hidden rounded-md border bg-card text-left shadow-soft",
                          border,
                          isDone && "opacity-60",
                          (isTask ? renderTaskTrigger : renderEventTrigger) &&
                            "transition-shadow hover:shadow-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        );
                        const range = timeRange(source.time, source.duration, b.end);
                        const tooltip = blockTooltip(source.title, range, itemTags(source));

                        const content = (
                          <>
                            {tint && (
                              <span className={cn("absolute inset-0", tint)} aria-hidden="true" />
                            )}
                            <span className={cn("relative w-1 shrink-0", stripe)} aria-hidden="true" />
                            <span className="relative min-w-0 flex-1 px-1.5 py-1">
                              {compact ? (
                                <span
                                  className={cn(
                                    "block truncate text-[10px] font-medium leading-tight",
                                    isDone && "text-muted-foreground line-through",
                                  )}
                                >
                                  {/* Only the start fits on one line at this size. */}
                                  {hasTime(source.time) && (
                                    <span className="text-mono mr-1 text-muted-foreground">{source.time}</span>
                                  )}
                                  {source.title}
                                </span>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      "block truncate text-[11px] font-semibold leading-tight",
                                      isDone && "text-muted-foreground line-through",
                                    )}
                                  >
                                    {source.title}
                                  </span>
                                  {range && (
                                    <span className="text-mono block truncate text-[10px] text-muted-foreground">
                                      {range}
                                    </span>
                                  )}
                                </>
                              )}
                            </span>
                          </>
                        );

                        const render = isTask ? renderTaskTrigger : renderEventTrigger;
                        const block = render ? (
                          <button
                            type="button"
                            style={style}
                            title={tooltip}
                            aria-label={`Abrir ${isTask ? "tarefa" : "evento"} "${source.title}"`}
                            className={blockClass}
                          >
                            {content}
                          </button>
                        ) : (
                          <div style={style} title={tooltip} className={blockClass}>
                            {content}
                          </div>
                        );

                        return (
                          <Fragment key={b.id}>
                            {b.kind === "task" && renderTaskTrigger
                              ? renderTaskTrigger(b.task, block)
                              : b.kind === "event" && renderEventTrigger
                                ? renderEventTrigger(b.event, block)
                                : block}
                          </Fragment>
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
