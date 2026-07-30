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

/**
 * App-wide quick jump: Cmd/Ctrl+K, or the raised bubble above "Mais" in the
 * bottom nav, opens a fuzzy search across every item's title. Selecting one
 * navigates to its section — there's no per-item route to deep-link into.
 * Rendered inside BottomNav.tsx (which stays mounted, just visually hidden
 * via `md:hidden`, so the Cmd/Ctrl+K shortcut keeps working on desktop too).
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

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="absolute -top-5 left-1/2 z-10 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-soft transition-transform hover:text-foreground active:scale-95"
      >
        <Search className="h-4 w-4" />
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
                <CommandItem key={g.id} value={`meta ${g.name}`} onSelect={() => go("/metas")}>
                  <Target className="mr-2 h-4 w-4 text-muted-foreground" />
                  {g.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {projects.length > 0 && (
            <CommandGroup heading="Projetos">
              {projects.map((p) => (
                <CommandItem key={p.id} value={`projeto ${p.name}`} onSelect={() => go("/projetos")}>
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
