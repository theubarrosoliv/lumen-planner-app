import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  CheckCircle2,
  User,
  Briefcase,
  Repeat,
  Network,
  StickyNote,
} from "lucide-react";
import { LumenMark } from "@/components/LumenMark";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const main = [
  { title: "Visão geral", url: "/", icon: LayoutDashboard },
  { title: "Agenda", url: "/agenda", icon: CheckCircle2 },
  { title: "Calendário", url: "/calendario", icon: Calendar },
];

const focus = [
  { title: "Hábitos", url: "/habitos", icon: Repeat },
  { title: "Pessoal", url: "/pessoal", icon: User },
  { title: "Profissional", url: "/profissional", icon: Briefcase },
  { title: "Mapa Mental", url: "/mapas", icon: Network },
  { title: "Notas", url: "/notas", icon: StickyNote },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const linkCls = (active: boolean) =>
    `relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-300 ${
      active
        ? "bg-gradient-primary text-primary-foreground shadow-elegant"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    }`;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-primary/40 bg-gradient-to-br from-background to-secondary/60 text-primary-glow shadow-glow">
            <LumenMark size={20} />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-display text-xl">Lumen</span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                planner
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Hoje
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} className={linkCls(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          {!collapsed && (
            <SidebarGroupLabel className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Foco
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {focus.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} className={linkCls(isActive(item.url))}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-sidebar-border bg-gradient-sheen p-4">
              <p className="font-display text-base leading-tight">
                Foco do dia
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pequenos passos, todos os dias.
              </p>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
