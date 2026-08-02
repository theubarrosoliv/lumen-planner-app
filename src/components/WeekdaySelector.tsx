import { WEEKDAY_OPTIONS } from "@/lib/date";
import { cn } from "@/lib/utils";

/** Multi-select row of ISO weekday chips (Seg..Dom), shared by task
 * recurrence and habit frequency editors — "toda terça e quinta" is the
 * same picker whether it's shaping a task or a habit. */
export function WeekdaySelector({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b));
  };

  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Dias da semana">
      {WEEKDAY_OPTIONS.map((opt) => {
        const active = value.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={cn(
              "h-8 min-w-[2.75rem] rounded-full border px-2 text-xs transition-colors",
              active
                ? "border-primary/60 bg-primary/15 text-primary-glow"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
