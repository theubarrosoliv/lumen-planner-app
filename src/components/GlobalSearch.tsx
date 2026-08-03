import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Repeat, Target, FolderKanban, CalendarDays, Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useUserData } from "@/store/useAppStore";
import { resolveDomain } from "@/lib/domain";

/**
 * App-wide quick jump: Cmd/Ctrl+K, or the fixed bottom-right bubble (the same
 * corner slot the habit "marcar período anterior" FAB used to occupy — see
 * task_628348eb for relocating that feature), opens a fuzzy search across
 * every item's title. Selecting one navigates to its section — there's no
 * per-item route to deep-link into. Rendered inside BottomNav.tsx (which
 * stays mounted, just visually hidden via `md:hidden`, so the Cmd/Ctrl+K
 * shortcut keeps working on desktop too).
 */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { tasks, habits, goals, projects, events } = useUserData();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const go = (to: string, subTab?: "metas" | "projetos") => {
    setOpen(false);
    navigate(to, subTab ? { state: { subTab } } : undefined);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="fixed bottom-[calc(5.5rem+theme(spacing.safe-bottom))] right-[calc(1.25rem+theme(spacing.safe-right))] z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-elegant transition-transform hover:scale-105 active:scale-95 md:bottom-[calc(1.5rem+theme(spacing.safe-bottom))] md:right-[calc(1.5rem+theme(spacing.safe-right))]"
      >
        <Search className="h-6 w-6" />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar tarefas, hábitos, metas, projetos, eventos…" />
        <CommandList>
          <CommandEmpty>Nada encontrado.</CommandEmpty>
          {tasks.length > 0 && (
            <CommandGroup heading="Tarefas">
              {tasks.map((t) => (
                <CommandItem key={t.id} value={`tarefa ${t.title}`} onSelect={() => go("/agenda")}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-muted-foreground" />
                  {t.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {habits.length > 0 && (
            <CommandGroup heading="Hábitos">
              {habits.map((h) => (
                <CommandItem key={h.id} value={`hábito ${h.name}`} onSelect={() => go("/habitos")}>
                  <Repeat className="mr-2 h-4 w-4 text-muted-foreground" />
                  {h.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {goals.length > 0 && (
            <CommandGroup heading="Metas">
              {goals.map((g) => (
                <CommandItem key={g.id} value={`meta ${g.name}`} onSelect={() => go(`/${resolveDomain(g)}`, "metas")}>
                  <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                  {g.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {projects.length > 0 && (
            <CommandGroup heading="Projetos">
              {projects.map((p) => (
                <CommandItem key={p.id} value={`projeto ${p.name}`} onSelect={() => go(`/${resolveDomain(p)}`, "projetos")}>
                  <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                  {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {events.length > 0 && (
            <CommandGroup heading="Eventos">
              {events.map((e) => (
                <CommandItem key={e.id} value={`evento ${e.title}`} onSelect={() => go("/calendario")}>
                  <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" />
                  {e.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
