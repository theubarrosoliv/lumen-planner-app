import { memo, useEffect, useRef, useState } from "react";
import { Handle, NodeProps, Position } from "@xyflow/react";
import { Plus, Trash2 } from "lucide-react";

export interface MindNodeData {
  text: string;
  isRoot?: boolean;
  onTextChange: (text: string) => void;
  onAddChild: () => void;
  onDelete: () => void;
  [key: string]: unknown;
}

function MindNodeCardBase({ data, selected }: NodeProps) {
  const d = data as MindNodeData;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.text);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setDraft(d.text);
  }, [d.text]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const commit = () => {
    const t = draft.trim();
    d.onTextChange(t || "Sem título");
    setEditing(false);
  };

  return (
    <div
      className={`group relative min-w-[140px] max-w-[240px] rounded-xl border px-4 py-2.5 text-sm shadow-soft transition-all ${
        d.isRoot
          ? "border-primary/60 bg-gradient-primary text-primary-foreground shadow-glow"
          : "border-border bg-card text-foreground"
      } ${selected ? "ring-2 ring-primary/60" : ""}`}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-primary/70 !border-0" />
      {editing ? (
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(d.text);
              setEditing(false);
            }
          }}
          rows={Math.max(1, draft.split("\n").length)}
          className="w-full resize-none bg-transparent outline-none"
        />
      ) : (
        <div className="whitespace-pre-wrap break-words leading-snug">{d.text}</div>
      )}

      <div
        className={`pointer-events-none absolute -right-2 -top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 ${
          selected ? "opacity-100" : ""
        }`}
      >
        <button
          type="button"
          className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-primary/60 bg-background text-primary-glow shadow-soft hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            d.onAddChild();
          }}
          title="Adicionar filho (Tab)"
        >
          <Plus className="h-3 w-3" />
        </button>
        {!d.isRoot && (
          <button
            type="button"
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full border border-destructive/60 bg-background text-destructive shadow-soft hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              d.onDelete();
            }}
            title="Excluir (Delete)"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-primary/70 !border-0" />
    </div>
  );
}

export const MindNodeCard = memo(MindNodeCardBase);
