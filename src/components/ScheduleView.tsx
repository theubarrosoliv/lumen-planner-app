import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar as DatePicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Task, CalEvent } from "@/store/types";
import { dateKey, todayKey } from "@/store/useAppStore";
import { timeToMinutes, layoutTimeline } from "@/lib/timeline";
import { PRIORITY_BLOCK_STYLE } from "@/lib/priority";
import { formatLongDate } from "@/lib/date";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 56; // px per hour
const DEFAULT_TASK_DURATION = 30; // minutes, when the task has none set
const DEFAULT_EVENT_DURATION = 60;
const MIN_BLOCK_HEIGHT = 26; // px — keeps very short/zero-duration blocks tappable

function shiftDate(key: string, deltaDays: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return dateKey(new Date(y, m - 1, d + deltaDays));
}

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const isToday = date === todayKey();

  const dayTasks = useMemo(() => tasks.filter((t) => t.date === date), [tasks, date]);
  const dayEvents = useMemo(() => events.filter((e) => e.date === date), [events, date]);

  const untimedTasks = dayTasks.filter((t) => timeToMinutes(t.time) === null);
  const untimedEvents = dayEvents.filter((e) => timeToMinutes(e.time) === null);

  const blocks = useMemo(() => {
    const taskBlocks = dayTasks
      .filter((t) => timeToMinutes(t.time) !== null)
      .map((t) => {
        const start = timeToMinutes(t.time)!;
        return {
          id: `task-${t.id}`,
          start,
          end: start + (t.duration ?? DEFAULT_TASK_DURATION),
          kind: "task" as const,
          task: t,
        };
      });
    const eventBlocks = dayEvents
      .filter((e) => timeToMinutes(e.time) !== null)
      .map((e) => {
        const start = timeToMinutes(e.time)!;
        return {
          id: `event-${e.id}`,
          start,
          end: start + (e.duration ?? DEFAULT_EVENT_DURATION),
          kind: "event" as const,
          event: e,
        };
      });
    return layoutTimeline([...taskBlocks, ...eventBlocks]);
  }, [dayTasks, dayEvents]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const now = new Date();
    const targetMinutes = isToday ? now.getHours() * 60 + now.getMinutes() - 120 : 8 * 60;
    scrollRef.current.scrollTop = Math.max(0, (targetMinutes / 60) * HOUR_HEIGHT);
    // Only re-run when the viewed day changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const nowMinutes = isToday ? new Date().getHours() * 60 + new Date().getMinutes() : null;

  return (
    <div className="rounded-2xl border border-border bg-gradient-card p-4 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl md:text-2xl">{formatLongDate(date)}</h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => onDateChange(shiftDate(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onDateChange(todayKey())}>
            Hoje
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Escolher data">
                <CalendarDays className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <DatePicker
                mode="single"
                selected={(() => {
                  const [y, m, d] = date.split("-").map(Number);
                  return new Date(y, m - 1, d);
                })()}
                onSelect={(d) => d && onDateChange(dateKey(d))}
                initialFocus
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={() => onDateChange(shiftDate(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {(untimedTasks.length > 0 || untimedEvents.length > 0) && (
        <div className="mb-3 flex flex-wrap gap-1.5 border-b border-border pb-3">
          {untimedEvents.map((e) =>
            renderEventTrigger(
              e,
              <span
                key={e.id}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs"
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", e.color)} />
                {e.title}
              </span>,
            ),
          )}
          {untimedTasks.map((t) => (
            <button
              key={t.id}
              onClick={() => onToggleTask(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                t.done ? "border-border text-muted-foreground line-through" : "border-border bg-secondary/50",
                t.priority && !t.done && PRIORITY_BLOCK_STYLE[t.priority],
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 items-center justify-center rounded-full border",
                  t.done ? "border-primary bg-gradient-primary" : "border-border",
                )}
              >
                {t.done && <Check className="h-2 w-2 text-primary-foreground" />}
              </span>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="relative max-h-[60vh] overflow-y-auto">
        <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="absolute inset-x-0 flex border-t border-border/60"
              style={{ top: h * HOUR_HEIGHT }}
            >
              <span className="w-12 shrink-0 -translate-y-1/2 pr-2 text-right text-[10px] text-muted-foreground/70">
                {String(h).padStart(2, "0")}h
              </span>
            </div>
          ))}

          {nowMinutes !== null && (
            <div
              className="absolute inset-x-0 z-20 flex items-center pl-12"
              style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}
            >
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              <div className="h-px flex-1 bg-destructive/70" />
            </div>
          )}

          <div className="absolute inset-y-0 left-12 right-0">
            {blocks.map((b) => {
              const top = (b.start / 60) * HOUR_HEIGHT;
              const height = Math.max(MIN_BLOCK_HEIGHT, ((b.end - b.start) / 60) * HOUR_HEIGHT);
              const widthPct = 100 / b.cols;
              const style = {
                top,
                height,
                left: `${b.col * widthPct}%`,
                width: `calc(${widthPct}% - 4px)`,
              };

              if (b.kind === "task") {
                const t = b.task;
                return (
                  <button
                    key={b.id}
                    onClick={() => onToggleTask(t.id)}
                    style={style}
                    className={cn(
                      "absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-xs transition-opacity",
                      t.done
                        ? "border-border bg-secondary/40 text-muted-foreground line-through opacity-70"
                        : t.priority
                          ? PRIORITY_BLOCK_STYLE[t.priority]
                          : "border-border bg-secondary/60",
                    )}
                  >
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="block truncate text-[10px] opacity-80">{t.time}</span>
                  </button>
                );
              }

              const e = b.event;
              return renderEventTrigger(
                e,
                <button
                  key={b.id}
                  style={style}
                  className="absolute z-10 overflow-hidden rounded-md border border-border/70 bg-secondary/60 px-2 py-1 text-left text-xs"
                >
                  <span className={cn("mb-0.5 block h-1 w-5 rounded-full", e.color)} />
                  <span className="block truncate font-medium">{e.title}</span>
                  {e.time && <span className="block truncate text-[10px] opacity-80">{e.time}</span>}
                </button>,
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
