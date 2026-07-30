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
 * App-wide quick jump: Cmd/Ctrl+K (desktop) or the search icon in the header
 * (any size) opens a fuzzy search across every item's title. Selecting one
 * navigates to its section — there's no per-item route to deep-link into.
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
        className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Search className="h-[18px] w-[18px]" />
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground/70 md:inline">
          ⌘K
        </kbd>
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
