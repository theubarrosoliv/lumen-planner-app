import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { Note as NoteType } from "@/store/types";

const NO_FOLDER = "__none__";

function Editor({ note }: { note: NoteType }) {
  const navigate = useNavigate();
  const { noteFolders } = useUserData();
  const updateNote = useAppStore((s) => s.updateNote);
  const removeNote = useAppStore((s) => s.removeNote);
  const { requestDelete, dialog } = useConfirmDelete();

  // Editor is remounted per note (see the `key={note.id}` in NotePage below),
  // so these only ever need to read their initial value once per note — no
  // separate effect to resync when the id changes.
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);

  // Debounced autosave — same 200ms pattern as the mind-map canvas
  // (src/pages/MindMap.tsx), so a keystroke doesn't write on every render.
  const saveRef = useRef<number | null>(null);
  const scheduleSave = useCallback(
    (patch: Partial<Pick<NoteType, "title" | "content">>) => {
      if (saveRef.current) window.clearTimeout(saveRef.current);
      saveRef.current = window.setTimeout(() => updateNote(note.id, patch), 200);
    },
    [note.id, updateNote],
  );

  useEffect(() => () => {
    // Flush on unmount so navigating away right after typing doesn't drop
    // the last 200ms of edits.
    if (saveRef.current) window.clearTimeout(saveRef.current);
  }, []);

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col md:h-[calc(100vh-6rem)]">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/notas")} aria-label="Voltar para notas">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <Select
            value={note.folderId ?? NO_FOLDER}
            onValueChange={(v) => updateNote(note.id, { folderId: v === NO_FOLDER ? undefined : v })}
          >
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLDER}>Sem pasta</SelectItem>
              {noteFolders.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Excluir nota"
            onClick={() =>
              requestDelete(
                () => {
                  removeNote(note.id);
                  navigate("/notas");
                },
                {
                  title: "Excluir nota?",
                  description: `"${note.title.trim() || "Sem título"}" será removida permanentemente.`,
                },
              )
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          scheduleSave({ title: e.target.value });
        }}
        placeholder="Título"
        className="mb-3 shrink-0 bg-transparent font-display text-2xl leading-tight text-foreground outline-none placeholder:text-muted-foreground/50 md:text-3xl"
      />

      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          scheduleSave({ content: e.target.value });
        }}
        placeholder="Escreva à vontade…"
        className="min-h-0 flex-1 resize-none border-none bg-transparent p-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
      />

      <p className="mt-2 shrink-0 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60">
        Editado {new Date(note.updatedAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
      </p>
      {dialog}
    </div>
  );
}

export default function NotePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notes } = useUserData();
  const note = notes.find((n) => n.id === id);

  if (!note) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="font-display text-2xl text-muted-foreground">Nota não encontrada.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/notas")}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar para notas
        </Button>
      </div>
    );
  }

  // Remount on note.id change so the Editor's local text state (which only
  // reads its initial value from `note` once) starts fresh for each note —
  // same reasoning as TaskDialog's `key` prop when reused across captures.
  return <Editor key={note.id} note={note} />;
}
