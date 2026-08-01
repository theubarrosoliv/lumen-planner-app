import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LumenMark } from "@/components/LumenMark";
import { toast } from "sonner";
import {
  isAllowedEmailProvider,
  normalizeEmail,
  ALLOWED_PROVIDERS_MESSAGE,
} from "@/lib/emailValidation";

type Mode = "login" | "signup" | "forgot";

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: string } };
  const userId = useAppStore((s) => s.currentUserId);
  const signup = useAppStore((s) => s.signup);
  const login = useAppStore((s) => s.login);
  const requestPasswordReset = useAppStore((s) => s.requestPasswordReset);

  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (userId) {
    return <Navigate to={location.state?.from ?? "/"} replace />;
  }

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!isAllowedEmailProvider(normalizedEmail)) {
      toast.error(ALLOWED_PROVIDERS_MESSAGE);
      return;
    }
    setBusy(true);
    const res = await requestPasswordReset(normalizedEmail);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Algo deu errado");
      return;
    }
    setResetSent(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    if (!isAllowedEmailProvider(normalizedEmail)) {
      toast.error(ALLOWED_PROVIDERS_MESSAGE);
      return;
    }
    const trimmedName = name.trim().slice(0, 80);
    if (mode === "signup" && !trimmedName) {
      toast.error("Informe seu nome.");
      return;
    }
    if (password.length < 8) {
      toast.error("Sua senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    setBusy(true);
    const res =
      mode === "signup"
        ? await signup(trimmedName, normalizedEmail, password)
        : await login(normalizedEmail, password);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error ?? "Algo deu errado");
      return;
    }
    toast.success(mode === "signup" ? "Conta criada com sucesso" : "Bem-vindo de volta");
    navigate(location.state?.from ?? "/", { replace: true });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-stretch gap-10 px-6 py-10 md:flex-row md:items-center md:gap-16 md:py-20">
        {/* Brand */}
        <div className="flex-1 animate-fade-in">
          <div className="mb-8 inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-background/60 shadow-glow">
              <LumenMark size={36} />
            </div>
            <div className="leading-tight">
              <p className="font-display text-2xl">Lumen</p>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                planner
              </p>
            </div>
          </div>
          <h1 className="font-display text-4xl leading-[1.05] md:text-6xl">
            Sua produtividade,
            <br />
            <span className="text-primary-glow">tudo em um lugar.</span>
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-muted-foreground md:text-base">
            Hábitos, agenda, metas e projetos. Em um só lugar.
          </p>
        </div>

        {/* Form */}
        <div className="w-full md:max-w-md">
          <div className="rounded-2xl border border-border bg-gradient-card p-8 shadow-elegant">
            {mode !== "forgot" && (
              <div className="mb-6 flex items-center gap-1 rounded-lg border border-border bg-secondary/40 p-1">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition-all ${
                    mode === "login"
                      ? "bg-gradient-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition-all ${
                    mode === "signup"
                      ? "bg-gradient-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Criar conta
                </button>
              </div>
            )}

            {mode === "forgot" ? (
              resetSent ? (
                <div className="space-y-4 py-2 text-center">
                  <p className="font-display text-xl">Verifique seu e-mail</p>
                  <p className="text-sm text-muted-foreground">
                    Se houver uma conta para <span className="text-foreground">{email}</span>,
                    enviamos um link para redefinir sua senha.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setMode("login");
                      setResetSent(false);
                    }}
                  >
                    Voltar para o login
                  </Button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="space-y-4">
                  <div>
                    <p className="font-display text-xl">Redefinir senha</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Informe seu e-mail e enviaremos um link para redefinir sua senha.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      E-mail
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      autoComplete="email"
                      autoFocus
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.01]"
                  >
                    {busy ? "Aguarde…" : "Enviar link de redefinição"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setMode("login")}
                  >
                    Voltar para o login
                  </Button>
                </form>
              )
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="name" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Nome
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Como podemos te chamar?"
                      autoComplete="name"
                      required
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Senha
                    </Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-primary-glow hover:underline"
                      >
                        Esqueci minha senha
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-gradient-primary shadow-elegant transition-transform hover:scale-[1.01]"
                >
                  {busy ? "Aguarde…" : mode === "signup" ? "Criar conta" : "Entrar"}
                </Button>

                <p className="pt-2 text-center text-[11px] text-muted-foreground">
                  Sua conta e seus dados vivem na nuvem — acesse de qualquer
                  dispositivo com o mesmo e-mail e senha.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}