import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  CheckCircle2,
  Calendar,
  Repeat,
  User,
  Briefcase,
  Network,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { QUICK_ADD } from "@/lib/quickAdd";
import { GlobalSearch } from "@/components/GlobalSearch";

/**
 * Mobile-only bottom tab bar, replacing the hamburger drawer as the primary
 * way to move around on a phone. Início/home now lives behind the logo mark
 * in the header (see AppLayout.tsx) instead of a bar slot. Agenda/Hábitos/
 * Calendário sit directly on the bar; Pessoal/Profissional/Mapa Mental live
 * behind "Mais". The center button is a raised quick-add, not a nav
 * destination. Hidden from `md` up, where the sidebar rail takes over.
 */
const mainTabs = [
  { to: "/agenda", label: "Agenda", icon: CheckCircle2, end: false },
  { to: "/habitos", label: "Hábitos", icon: Repeat, end: false },
];

const moreTabs = [
  { to: "/pessoal", label: "Pessoal", icon: User },
  { to: "/profissional", label: "Profissional", icon: Briefcase },
  { to: "/mapas", label: "Mapa Mental", icon: Network },
];

const tabCls = (isActive: boolean) =>
  `flex w-full flex-col items-center gap-1 px-0.5 py-2 text-[10px] font-medium transition-colors ${
    isActive ? "text-primary-glow" : "text-muted-foreground hover:text-foreground"
  }`;

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = moreTabs.some((t) => pathname.startsWith(t.to));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-safe-bottom backdrop-blur-xl md:hidden">
      <ul className="flex items-stretch justify-around">
        {mainTabs.map((t) => (
          <li key={t.to} className="flex-1">
            <NavLink to={t.to} end={t.end} className={({ isActive }) => tabCls(isActive)}>
              <t.icon className="h-[22px] w-[22px] shrink-0" />
              <span className="max-w-full truncate">{t.label}</span>
            </NavLink>
          </li>
        ))}

        {/* Center quick-add: raised above the bar, opens the same choices as
            the Dashboard's "Novo item" button so both entry points agree. */}
        <li className="flex flex-1 items-start justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Adicionar"
                className="-mt-5 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform active:scale-95"
              >
                <Plus className="h-6 w-6" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" sideOffset={12} className="w-44">
              {QUICK_ADD.map((q) => (
                <DropdownMenuItem key={q.to} onClick={() => navigate(q.to)} className="cursor-pointer">
                  <q.icon className="mr-2 h-4 w-4" />
                  {q.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </li>

        <li className="flex-1">
          <NavLink to="/calendario" className={({ isActive }) => tabCls(isActive)}>
            <Calendar className="h-[22px] w-[22px] shrink-0" />
            <span className="max-w-full truncate">Calendário</span>
          </NavLink>
        </li>

        <li className="flex-1">
          {/* Fixed-position, not tied to this li's box — see GlobalSearch.tsx. */}
          <GlobalSearch />
          <button onClick={() => setMoreOpen(true)} className={tabCls(moreActive)}>
            <MoreHorizontal className="h-[22px] w-[22px] shrink-0" />
            <span className="max-w-full truncate">Mais</span>
          </button>
        </li>
      </ul>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-border pb-safe-bottom">
          <SheetHeader>
            <SheetTitle className="font-display text-xl">Mais</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {moreTabs.map((t) => (
              <button
                key={t.to}
                onClick={() => {
                  navigate(t.to);
                  setMoreOpen(false);
                }}
                className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm transition-colors ${
                  pathname.startsWith(t.to)
                    ? "border-primary/50 bg-primary/10 text-primary-glow"
                    : "border-border bg-secondary/30 text-foreground hover:border-primary/30"
                }`}
              >
                <t.icon className="h-5 w-5" />
                {t.label}
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
