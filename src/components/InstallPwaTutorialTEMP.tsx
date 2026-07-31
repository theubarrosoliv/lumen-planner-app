/**
 * PROVISIONAL — one-time nudge, shown right after a brand-new signup, that
 * walks iPhone users through adding the PWA to their home screen. Meant to be
 * deleted once it's done its job.
 *
 * To remove later:
 *  1. Delete this file.
 *  2. In src/pages/Auth.tsx, remove the `markFreshSignup` import + call.
 *  3. In src/components/AppLayout.tsx, remove the `InstallPwaTutorial` import + render.
 */
import { useEffect, useState } from "react";
import { Share, PlusSquare } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isIOS, isStandalonePWA } from "@/lib/deviceDetect";

const FLAG_KEY = "lumen-temp-just-signed-up";

/** Call once, right after a NEW account is created — not on regular logins. */
export function markFreshSignup() {
  try {
    sessionStorage.setItem(FLAG_KEY, "1");
  } catch {
    /* sessionStorage unavailable (e.g. private mode) — tutorial just won't show */
  }
}

export function InstallPwaTutorial() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let justSignedUp = false;
    try {
      justSignedUp = sessionStorage.getItem(FLAG_KEY) === "1";
    } catch {
      /* ignore */
    }
    if (justSignedUp && isIOS() && !isStandalonePWA()) {
      setOpen(true);
    }
  }, []);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.removeItem(FLAG_KEY);
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="border-border bg-card">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Instale o Lumen no seu iPhone</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2 text-sm text-muted-foreground">
          <p>
            Adicione o Lumen à tela de início para abrir como um app — em tela cheia,
            sem a barra do navegador.
          </p>
          <ol className="space-y-3">
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-secondary/40 text-xs text-foreground">
                1
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Toque no ícone de compartilhar
                <Share className="h-4 w-4 text-primary-glow" />
                na barra do Safari
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-secondary/40 text-xs text-foreground">
                2
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                Toque em
                <PlusSquare className="h-4 w-4 text-primary-glow" />
                "Adicionar à Tela de Início"
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-secondary/40 text-xs text-foreground">
                3
              </span>
              <span>Confirme tocando em "Adicionar"</span>
            </li>
          </ol>
        </div>
        <Button onClick={close} className="w-full bg-gradient-primary shadow-elegant">
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
