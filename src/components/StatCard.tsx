import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  accent?: "primary" | "success" | "warning" | "muted";
  className?: string;
}

const accentMap = {
  primary: "from-primary/30 to-primary/0 text-primary-glow",
  success: "from-success/30 to-success/0 text-success",
  warning: "from-warning/30 to-warning/0 text-warning",
  muted: "from-muted/40 to-muted/0 text-muted-foreground",
};

export function StatCard({ label, value, hint, icon, accent = "primary", className }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border bg-gradient-card p-5 transition-all duration-500 hover:border-primary/40 hover:shadow-elegant",
        className
      )}
    >
      <div
        className={cn(
          "absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-500 group-hover:opacity-100",
          accentMap[accent],
          "opacity-60"
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-3xl">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary/60 text-foreground/80">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
