import { useState } from "react";
import { useLocation } from "react-router-dom";
import { SectionHeader } from "@/components/SectionHeader";
import { Target, Layers } from "lucide-react";
import { LifeDomain } from "@/store/types";
import { GoalsSection } from "@/pages/Goals";
import { ProjectsSection } from "@/pages/Projects";
import { cn } from "@/lib/utils";

const COPY: Record<LifeDomain, { title: string; description: string }> = {
  pessoal: {
    title: "Sua vida, fora do expediente.",
    description: "Metas e projetos pessoais, num só lugar.",
  },
  profissional: {
    title: "Onde o trabalho ganha forma.",
    description: "Metas e projetos da carreira, num só lugar.",
  },
};

/** Shared shell for the Pessoal and Profissional pages: one SectionHeader,
 * a Metas/Projetos sub-tab, and the matching section underneath. Splitting
 * by life area (not by "shape") means each side still needs both a
 * state-tracked Meta and a task-tracked Projeto — so both live here instead
 * of one replacing the other. */
export function LifeDomainPage({ domain }: { domain: LifeDomain }) {
  const location = useLocation();
  const initialTab = (location.state as { subTab?: "metas" | "projetos" } | null)?.subTab ?? "metas";
  const [tab, setTab] = useState<"metas" | "projetos">(initialTab);
  const copy = COPY[domain];

  return (
    <div className="mx-auto max-w-6xl">
      <SectionHeader eyebrow={domain === "pessoal" ? "Pessoal" : "Profissional"} title={copy.title} description={copy.description} />

      <div className="mb-6 flex gap-1 rounded-lg border border-border bg-secondary/40 p-1 w-fit">
        {(
          [
            { key: "metas", label: "Metas", icon: Target },
            { key: "projetos", label: "Projetos", icon: Layers },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs uppercase tracking-[0.2em] transition-all",
              tab === t.key
                ? "bg-gradient-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-3 w-3" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "metas" ? <GoalsSection domain={domain} /> : <ProjectsSection domain={domain} />}
    </div>
  );
}
