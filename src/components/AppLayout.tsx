import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BottomNav } from "@/components/BottomNav";
import { LumenMark } from "@/components/LumenMark";
import { GlobalSearch } from "@/components/GlobalSearch";
import { LogOut, WifiOff, BellRing } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffect, useState } from "react";

function useOnline() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.currentUser());
  const logout = useAppStore((s) => s.logout);
  const online = useOnline();

  const initials = (user?.name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/70 px-4 pt-safe-top backdrop-blur-xl md:px-8">
            {/* The bottom tab bar (+ its "Mais" sheet) replaces the drawer as
                the mobile navigation entry point, so the trigger only shows
                where the sidebar rail is actually visible (md+). */}
            <SidebarTrigger className="hidden text-muted-foreground hover:text-foreground md:inline-flex" />

            {/* Mobile-only: home now lives here instead of a bottom-bar slot. */}
            <button
              onClick={() => navigate("/")}
              aria-label="Início"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-gradient-to-br from-background to-secondary/60 text-primary-glow shadow-glow transition-transform active:scale-95 md:hidden"
            >
              <LumenMark size={20} />
            </button>

            <div className="ml-auto flex items-center gap-2">
              {!online && (
                <div className="hidden items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-warning sm:flex">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </div>
              )}

              <GlobalSearch />

              <ThemeToggle />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-primary text-xs font-medium text-primary-foreground shadow-soft transition-transform hover:scale-105">
                    {initials}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="text-sm">{user?.name}</span>
                      <span className="text-xs text-muted-foreground">{user?.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => navigate("/notificacoes")}
                    className="cursor-pointer"
                  >
                    <BellRing className="mr-2 h-4 w-4" />
                    Notificações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate("/auth", { replace: true });
                    }}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:px-8 md:py-10 md:pb-10">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar (hidden on md+ where the sidebar takes over) */}
        <BottomNav />
      </div>
    </SidebarProvider>
  );
}
