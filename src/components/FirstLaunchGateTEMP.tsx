/**
 * PROVISIONAL — first-launch gate for iPhone Safari. Meant to be deleted
 * once it's done its job.
 *
 * Wraps the ENTIRE app (mounted in src/App.tsx, above <BrowserRouter>), so
 * it's the first thing rendered — before /auth, before login/signup, on
 * every fresh Safari session (sessionStorage clears when the tab closes,
 * so it reappears each time, not just once ever):
 *
 *  1. Not installed yet (isStandalonePWA() false) → full-screen "add to
 *     home screen" walkthrough. Dismissible for this session only ("Continuar
 *     no navegador") since we can't detect a real install from inside the
 *     same Safari tab — the user has to actually relaunch from the new
 *     home-screen icon for isStandalonePWA() to ever read true.
 *  2. Running as the installed app AND notification permission was never
 *     decided (Notification.permission === "default") → a single-tap
 *     "Ativar notificações" screen. WebKit requires the permission prompt
 *     to originate from a real user gesture — it cannot be fired with zero
 *     taps — so this piggybacks on the one tap the user makes here instead
 *     of making them hunt for the toggle in Configurações. Only shown once
 *     a user is logged in (notification prefs are per-account data).
 *
 * To remove later:
 *  1. Delete this file.
 *  2. In src/App.tsx, remove the <FirstLaunchGate> wrapper (unwrap its children).
 */
import { ReactNode, useEffect, useState } from "react";
import { Share, PlusSquare, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LumenMark } from "@/components/LumenMark";
import { isIOS, isStandalonePWA } from "@/lib/deviceDetect";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useAppStore } from "@/store/useAppStore";

const INSTALL_DISMISSED_KEY = "lumen-temp-install-gate-dismissed";

type Step = "install" | "notify" | "none";

function installDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(INSTALL_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function computeStep(loggedIn: boolean): Step {
  if (!isIOS()) return "none";
  if (!isStandalonePWA()) return installDismissedThisSession() ? "none" : "install";
  if (!loggedIn) return "none";
  if (typeof Notification !== "undefined" && Notification.permission === "default") return "notify";
  return "none";
}

function GateScreen({
  title,
  description,
  children,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-gradient-card p-8 shadow-elegant text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl border border-primary/30 bg-background/60 shadow-glow">
          <LumenMark size={30} />
        </div>
        <h1 className="font-display text-2xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        {children && <div className="mt-5 space-y-3 text-left text-sm text-muted-foreground">{children}</div>}
        <div className="mt-6 space-y-2">
          <Button onClick={onPrimary} className="w-full bg-gradient-primary shadow-elegant">
            {primaryLabel}
          </Button>
          {secondaryLabel && onSecondary && (
            <Button variant="ghost" onClick={onSecondary} className="w-full">
              {secondaryLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-secondary/40 text-xs text-foreground">
        {n}
      </span>
      <span className="flex flex-wrap items-center gap-1.5">{children}</span>
    </div>
  );
}

export function FirstLaunchGate({ children }: { children: ReactNode }) {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const setNotificationPrefs = useAppStore((s) => s.setNotificationPrefs);
  const { enable } = usePushNotifications();
  const [step, setStep] = useState<Step>(() => computeStep(!!currentUserId));

  useEffect(() => {
    // Only auto-advance INTO "notify" once it newly becomes eligible (e.g.
    // right after login) — never interrupt an install step still on screen,
    // and never re-open something already resolved this render cycle.
    if (step !== "none") return;
    if (computeStep(!!currentUserId) === "notify") setStep("notify");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  if (step === "install") {
    return (
      <GateScreen
        title="Instale o Lumen no seu iPhone"
        description="Adicione à tela de início para abrir como um app — em tela cheia, sem a barra do navegador."
        primaryLabel="Entendi"
        onPrimary={() => {
          try {
            sessionStorage.setItem(INSTALL_DISMISSED_KEY, "1");
          } catch {
            /* ignore */
          }
          setStep("none");
        }}
      >
        <StepRow n={1}>
          Toque no ícone de compartilhar
          <Share className="h-4 w-4 text-primary-glow" />
          na barra do Safari
        </StepRow>
        <StepRow n={2}>
          Toque em
          <PlusSquare className="h-4 w-4 text-primary-glow" />
          "Adicionar à Tela de Início"
        </StepRow>
        <StepRow n={3}>Confirme tocando em "Adicionar"</StepRow>
      </GateScreen>
    );
  }

  if (step === "notify") {
    return (
      <GateScreen
        title="Ative as notificações"
        description="Avisos de compromissos, hábitos e prazos direto no seu iPhone — mesmo com o app fechado."
        primaryLabel="Ativar notificações"
        onPrimary={async () => {
          setNotificationPrefs({ enabled: true });
          await enable();
          setStep("none");
        }}
        secondaryLabel="Agora não"
        onSecondary={() => setStep("none")}
      >
        <div className="flex items-center gap-2.5">
          <BellRing className="h-5 w-5 shrink-0 text-primary-glow" />
          <span>O iPhone vai pedir sua confirmação — toque em "Permitir" na tela seguinte.</span>
        </div>
      </GateScreen>
    );
  }

  return <>{children}</>;
}
