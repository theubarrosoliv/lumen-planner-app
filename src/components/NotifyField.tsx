import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export type NotifyTimingKind = "minutesBefore" | "daysBefore" | "none";

const TIMING_LABEL: Record<Exclude<NotifyTimingKind, "none">, string> = {
  minutesBefore: "Avisar quantos minutos antes",
  daysBefore: "Avisar quantos dias antes",
};

/**
 * Per-item "Notificar" toggle + optional timing override, used in every
 * create/edit dialog (Task, Goal, Milestone, Project, ProjectTask, Habit,
 * CalEvent). When off, this item never notifies regardless of the global
 * category toggle in /notificacoes; when on (the default), it still needs
 * the matching global category enabled to actually fire.
 */
export function NotifyField({
  notify,
  onNotifyChange,
  timingKind,
  timing,
  onTimingChange,
  globalDefault,
}: {
  notify: boolean;
  onNotifyChange: (v: boolean) => void;
  timingKind: NotifyTimingKind;
  timing?: number;
  onTimingChange?: (v: number | undefined) => void;
  globalDefault?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
        <Label htmlFor="notify-item" className="text-sm font-normal">
          Notificar
        </Label>
        <Switch id="notify-item" checked={notify} onCheckedChange={onNotifyChange} />
      </div>

      {notify && timingKind !== "none" && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {TIMING_LABEL[timingKind]}
          </Label>
          <Input
            type="number"
            min={0}
            placeholder={globalDefault !== undefined ? `Padrão: ${globalDefault}` : undefined}
            value={timing ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onTimingChange?.(raw === "" ? undefined : Number(raw));
            }}
          />
        </div>
      )}
    </div>
  );
}
