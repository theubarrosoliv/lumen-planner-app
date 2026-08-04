import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderPlus, StickyNote, Trash2, Pencil, Check } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { cn } from "@/lib/utils";

type FolderTab = "all" | "none" | string;

/** Create/rename/delete folders from one popover — mirrors the inline
 * create-then-manage pattern TagMultiSelect uses for custom tags, rather
 * than a separate "manage folders" screen for what's a lightweight list. */
function FolderManager({ activeFolder, onSelect }: { activeFolder: FolderTab; onSelect: (f: FolderTab) => void }) {
  const { noteFolders } = useUserData();
  const addNoteFolder = useAppStore((s) => s.addNoteFolder);
  const renameNoteFolder = useAppStore((s) => s.renameNoteFolder);
  const removeNoteFolder = useAppStore((s) => s.removeNoteFolder);
  const { requestDelete, dialog } = useConfirmDelete();

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const create = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const id = addNoteFolder(trimmed);
    setDraft("");
    onSelect(id);
  };

  const confirmRename = (id: string) => {
    const trimmed = editDraft.trim();
    if (trimmed) renameNoteFolder(id, trimmed);
    setEditingId(null);
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 text-xs">
            <FolderPlus className="mr-1 h-3.5 w-3.5" /> Pastas
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-1">
          <div className="flex gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nova pasta…"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  create();
                }
              }}
            />
            <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={create}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {noteFolders.length > 0 && (
            <div className="max-h-56 space-y-0.5 overflow-y-auto pt-1">
              {noteFolders.map((f) =>
                editingId === f.id ? (
                  <div key={f.id} className="flex gap-1.5">
                    <Input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmRename(f.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={() => confirmRename(f.id)}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    key={f.id}
                    className="flex cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary/40"
                    onClick={() => {
                      onSelect(f.id);
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{f.name}</span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(f.id);
                          setEditDraft(f.name);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          requestDelete(
                            () => {
                              if (activeFolder === f.id) onSelect("all");
                              removeNoteFolder(f.id);
                            },
                            {
                              title: `Excluir pasta "${f.name}"?`,
                              description: "As notas dentro dela não são excluídas — ficam sem pasta.",
                            },
                          );
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </PopoverContent>
      </Popover>
      {dialog}
    </>
  );
}

export default function Notes() {
  const navigate = useNavigate();
  const { notes, noteFolders } = useUserData();
  const addNote = useAppStore((s) => s.addNote);
  const removeNote = useAppStore((s) => s.removeNote);
  const { requestDelete, dialog } = useConfirmDelete();

  const [activeFolder, setActiveFolder] = useState<FolderTab>("all");

  const filtered = useMemo(() => {
    const list =
      activeFolder === "all"
        ? notes
        : activeFolder === "none"
          ? notes.filter((n) => !n.folderId)
          : notes.filter((n) => n.folderId === activeFolder);
    return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [notes, activeFolder]);

  const handleCreate = () => {
    const folderId = activeFolder === "all" || activeFolder === "none" ? undefined : activeFolder;
    const id = addNote(folderId);
    navigate(`/notas/${id}`);
  };

  const tabCls = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-3 py-1 text-xs uppercase tracking-[0.15em] transition-all",
      active
        ? "bg-gradient-primary text-primary-foreground shadow-soft"
        : "border border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
    );

  return (
    <div className="mx-auto max-w-5xl">
      <SectionHeader
        eyebrow="Notas"
        title="Escreva à vontade."
        description="Texto livre, organizado em pastas — sem formulário, sem campos obrigatórios."
        action={
          <Button onClick={handleCreate} className="bg-gradient-primary shadow-elegant">
            <Plus className="mr-1 h-4 w-4" /> Nova nota
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <button className={tabCls(activeFolder === "all")} onClick={() => setActiveFolder("all")}>
          Todas
        </button>
        {noteFolders.map((f) => (
          <button key={f.id} className={tabCls(activeFolder === f.id)} onClick={() => setActiveFolder(f.id)}>
            {f.name}
          </button>
        ))}
        <button className={tabCls(activeFolder === "none")} onClick={() => setActiveFolder("none")}>
          Sem pasta
        </button>
        <FolderManager activeFolder={activeFolder} onSelect={setActiveFolder} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-gradient-card py-16 text-center">
          <StickyNote className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-display text-2xl text-muted-foreground">Nada por aqui ainda.</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            {activeFolder === "all" ? "Crie sua primeira nota." : "Nenhuma nota nesta pasta."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n, i) => {
            const folder = n.folderId ? noteFolders.find((f) => f.id === n.folderId) : undefined;
            return (
              <div
                key={n.id}
                className="group relative flex min-h-[9rem] flex-col rounded-2xl border border-border bg-gradient-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-elegant animate-rise"
                style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
              >
                <button onClick={() => navigate(`/notas/${n.id}`)} className="flex flex-1 flex-col text-left">
                  <h3 className="font-display text-lg leading-tight">
                    {n.title.trim() || <span className="text-muted-foreground">Sem título</span>}
                  </h3>
                  <p className="mt-1.5 line-clamp-4 flex-1 whitespace-pre-line text-sm text-muted-foreground">
                    {n.content.trim() || "Nota vazia."}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70">
                    <span>
                      {new Date(n.updatedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                    {folder && (
                      <>
                        <span>·</span>
                        <span className="truncate">{folder.name}</span>
                      </>
                    )}
                  </div>
                </button>
                <button
                  onClick={() =>
                    requestDelete(() => removeNote(n.id), {
                      title: "Excluir nota?",
                      description: `"${n.title.trim() || "Sem título"}" será removida permanentemente.`,
                    })
                  }
                  aria-label="Excluir nota"
                  className="absolute right-3 top-3 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {dialog}
    </div>
  );
}
