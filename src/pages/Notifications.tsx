import { SectionHeader } from "@/components/SectionHeader";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { BellRing, Smartphone, Download } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { NotificationCategoryPrefs } from "@/store/types";

const CATEGORY_LABELS: Record<keyof NotificationCategoryPrefs, string> = {
  taskReminder: "Compromissos próximos",
  dailyAgenda: "Agenda do dia",
  eventReminder: "Evento do dia",
  habitReminder: "Lembrete de hábito pendente",
  habitStreakRisk: "Sequência de hábito em risco",
  goalDeadline: "Prazo de meta próximo",
  milestoneDeadline: "Prazo de marco próximo",
  projectDeadline: "Prazo de projeto próximo",
  projectTaskDeadline: "Prazo de tarefa de projeto próximo",
};

export default function Notifications() {
  const { status, enable, tokenStatus, tokenError } = usePushNotifications();
  const { notificationPrefs: prefs } = useUserData();
  const setNotificationPrefs = useAppStore((s) => s.setNotificationPrefs);

  const toggleCategory = (key: keyof NotificationCategoryPrefs, value: boolean) => {
    setNotificationPrefs({ categories: { ...prefs.categories, [key]: value } });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        eyebrow="Notificações"
        title="Deixe o Lumen te avisar."
        description="Compromissos, hábitos e prazos direto no seu celular — mesmo com o app fechado."
      />

      {status === "unsupported" && (
        <div className="rounded-2xl border border-border bg-gradient-card p-6 text-center">
          <Smartphone className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-xl">Disponível apenas no celular</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Notificações push do Lumen funcionam só no app mobile.
          </p>
        </div>
      )}

      {status === "ios-needs-install" && (
        <div className="rounded-2xl border border-border bg-gradient-card p-6 text-center">
          <Download className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-xl">Adicione à tela de início</p>
          <p className="mt-1 text-sm text-muted-foreground">
            No iPhone, o Safari só permite notificações em apps instalados. Toque em
            Compartilhar → "Adicionar à Tela de Início" e abra o Lumen por lá.
          </p>
        </div>
      )}

      {(status === "idle" || status === "denied" || status === "granted") && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-border bg-gradient-card p-5">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-primary-glow" />
              <div>
                <p className="font-display text-lg">Ativar notificações</p>
                <p className="text-xs text-muted-foreground">
                  {status === "denied"
                    ? "Bloqueadas nas configurações do navegador/app."
                    : status === "granted"
                      ? "Ativadas neste dispositivo."
                      : "Toque para permitir."}
                </p>
              </div>
            </div>
            <Switch
              checked={status === "granted"}
              disabled={status === "denied"}
              onCheckedChange={(checked) => checked && enable()}
            />
          </div>

          {status === "granted" && (
            <p className="px-1 text-xs text-muted-foreground">
              {tokenStatus === "registering" && "Registrando este dispositivo…"}
              {tokenStatus === "saved" && "✓ Dispositivo registrado para receber notificações."}
              {tokenStatus === "error" && (
                <span className="text-destructive">Falha ao registrar dispositivo: {tokenError}</span>
              )}
            </p>
          )}

          {status === "granted" && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Categorias
                </p>
                {(Object.keys(CATEGORY_LABELS) as (keyof NotificationCategoryPrefs)[]).map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-4 py-3"
                  >
                    <Label htmlFor={key} className="text-sm font-normal">
                      {CATEGORY_LABELS[key]}
                    </Label>
                    <Switch
                      id={key}
                      checked={prefs.categories[key]}
                      onCheckedChange={(checked) => toggleCategory(key, checked)}
                    />
                  </div>
                ))}
              </div>

              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Aviso antes do compromisso (min)
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={prefs.taskReminderMinutesBefore}
                    onChange={(e) =>
                      setNotificationPrefs({ taskReminderMinutesBefore: Number(e.target.value) || 1 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Hora da agenda do dia
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={prefs.dailyAgendaHour}
                    onChange={(e) =>
                      setNotificationPrefs({ dailyAgendaHour: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Hora do lembrete de hábito
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={prefs.habitReminderHour}
                    onChange={(e) =>
                      setNotificationPrefs({ habitReminderHour: Number(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    Dias antes do prazo
                  </Label>
                  <Input
                    value={prefs.deadlineLeadDays.join(", ")}
                    onChange={(e) =>
                      setNotificationPrefs({
                        deadlineLeadDays: e.target.value
                          .split(",")
                          .map((v) => Number(v.trim()))
                          .filter((n) => Number.isFinite(n) && n >= 0),
                      })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
