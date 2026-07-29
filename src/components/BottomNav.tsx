import { NavLink } from "react-router-dom";
import { LayoutDashboard, CheckCircle2, Calendar, Repeat, Target } from "lucide-react";

/**
 * Mobile-only bottom tab bar. The sidebar (opened via the header trigger)
 * still holds the full destination list — including Projetos and Mapa Mental —
 * but on a phone the five most-used sections deserve one-tap access instead of
 * a two-tap drawer. Hidden from `md` up, where the sidebar rail takes over.
 */
const tabs = [
  { to: "/", label: "Início", icon: LayoutDashboard, end: true },
  { to: "/agenda", label: "Agenda", icon: CheckCircle2, end: false },
  { to: "/calendario", label: "Calendário", icon: Calendar, end: false },
  { to: "/habitos", label: "Hábitos", icon: Repeat, end: false },
  { to: "/metas", label: "Metas", icon: Target, end: false },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-safe-bottom backdrop-blur-xl md:hidden">
      <ul className="flex items-stretch justify-around">
        {tabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
                }`
              }
            >
              <t.icon className="h-[22px] w-[22px] shrink-0" />
              <span className="max-w-full truncate">{t.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
