import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LumenMark } from "@/components/LumenMark";
import { toast } from "sonner";

type LinkStatus = "checking" | "valid" | "invalid";

export default function ResetPassword() {
  const navigate = useNavigate();
  const updatePassword = useAppStore((s) => s.updatePassword);
  const [linkStatus, setLinkStatus] = useState<LinkStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The recovery link's token lives in the URL hash; the Supabase client
    // consumes it on load (detectSessionInUrl, on by default) and turns it
    // into a real session. That happens asynchronously, so we check the
    // current session AND listen for the PASSWORD_RECOVERY event, whichever
    // comes first — falling back to "invalid" only after a short grace
    // period so an expired/already-used link shows a clear message instead
    // of hanging on "checking" forever.
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setLinkStatus(ok ? "valid" : "invalid");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        finish(true);
      }
    });

    const timeout = setTimeout(() => finish(false), 3000);

    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Sua senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Não foi possível redefinir a senha.");
      return;
    }
    toast.success("Senha redefinida com sucesso.");
    navigate("/", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 py-10">
        <div className="mb-8 inline-flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-background/60 shadow-glow">
            <LumenMark size={36} />
          </div>
          <div className="leading-tight">
            <p className="font-display text-2xl">Lumen</p>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">planner</p>
          </div>
        </div>

        <div className="w-full rounded-2xl border border-border bg-gradient-card p-8 shadow-elegant">
          {linkStatus === "checking" && (
            <p className="text-center text-sm text-muted-foreground">Verificando link…</p>
          )}

          {linkStatus === "invalid" && (
            <div className="space-y-4 text-center">
              <p className="font-display text-xl">Link inválido ou expirado</p>
              <p className="text-sm text-muted-foreground">
                Solicite um novo link de redefinição de senha na tela de login.
              </p>
              <Button
                type="button"
                className="w-full bg-gradient-primary shadow-elegant"
                onClick={() => navigate("/auth", { replace: true })}
              >
                Voltar para o login
              </Button>
            </div>
          )}

          {linkStatus === "valid" && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <p className="font-display text-xl">Nova senha</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Escolha uma nova senha para sua conta.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Nova senha
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Confirmar senha
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.01]"
              >
                {busy ? "Aguarde…" : "Redefinir senha"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
