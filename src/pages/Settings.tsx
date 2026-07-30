import { useTheme } from "next-themes";
import { Link } from "react-router-dom";
import { Sun, Moon, MonitorSmartphone, BellRing, ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";

const THEMES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: MonitorSmartphone },
] as const;

export default function Settings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        eyebrow="Configurações"
        title="Do seu jeito."
        description="Aparência do app e preferências de notificação."
      />

      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-gradient-card p-6">
          <h2 className="font-display text-xl">Aparência</h2>
          <p className="mt-1 text-xs text-muted-foreground">Escolha o tema do aplicativo.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition-colors ${
                  theme === t.value
                    ? "border-primary/50 bg-primary/10 text-primary-glow"
                    : "border-border bg-secondary/30 text-foreground hover:border-primary/30"
                }`}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <Link
          to="/notificacoes"
          className="flex items-center gap-4 rounded-2xl border border-border bg-gradient-card p-6 transition-colors hover:border-primary/40"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/40">
            <BellRing className="h-5 w-5 text-primary-glow" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-xl">Notificações</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Horários, antecedência e o que avisa em cada área.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
