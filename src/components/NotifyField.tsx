import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NotifyLeadUnit } from "@/store/types";

const UNIT_LABEL: Record<NotifyLeadUnit, string> = {
  minutes: "minutos",
  hours: "horas",
  days: "dias",
  weeks: "semanas",
};

/**
 * Per-item "Notificar" toggle + fully free lead-time override (any number,
 * any unit), used identically in every create/edit dialog (Task, Goal,
 * Milestone, Project, ProjectTask, Habit, CalEvent). When off, this item
 * never notifies regardless of the global category toggle in /notificacoes;
 * when on (the default), it still needs the matching global category
 * enabled to actually fire. Leaving the number blank means "use whatever
 * default that category has in /notificacoes" instead of a custom value.
 */
export function NotifyField({
  notify,
  onNotifyChange,
  leadValue,
  leadUnit,
  onLeadValueChange,
  onLeadUnitChange,
}: {
  notify: boolean;
  onNotifyChange: (v: boolean) => void;
  leadValue?: number;
  leadUnit?: NotifyLeadUnit;
  onLeadValueChange: (v: number | undefined) => void;
  onLeadUnitChange: (v: NotifyLeadUnit) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3">
        <Label htmlFor="notify-item" className="text-sm font-normal">
          Notificar
        </Label>
        <Switch id="notify-item" checked={notify} onCheckedChange={onNotifyChange} />
      </div>

      {notify && (
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Avisar com quanto tempo de antecedência
          </Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              placeholder="Personalizado"
              value={leadValue ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                onLeadValueChange(raw === "" ? undefined : Number(raw));
              }}
              className="flex-1"
            />
            <Select value={leadUnit ?? "minutes"} onValueChange={(v) => onLeadUnitChange(v as NotifyLeadUnit)}>
              <SelectTrigger className="w-32 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNIT_LABEL) as NotifyLeadUnit[]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Deixe em branco pra usar o padrão definido em Notificações.
          </p>
        </div>
      )}
    </div>
  );
}
