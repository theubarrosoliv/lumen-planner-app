import { Fragment, memo, useEffect, useRef, useState } from "react";
import { Handle, NodeProps, NodeToolbar, Position } from "@xyflow/react";
import { Pencil, Plus, Trash2 } from "lucide-react";

export interface MindNodeData {
  text: string;
  isRoot?: boolean;
  /** Ready `hsl(...)` string for this node's branch ring/edge color — absent for the root. */
  branchColor?: string;
  /** Same hue as `branchColor`, low alpha, used as the card's background tint. */
  tintColor?: string;
  onTextChange: (text: string) => void;
  onAddChild: () => void;
  onDelete: () => void;
  [key: string]: unknown;
}

const HANDLE_POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

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

  const isRoot = !!d.isRoot;

  return (
    <div
      className={`group relative flex items-center justify-center text-center transition-all ${
        isRoot
          ? "min-h-[104px] w-auto max-w-[220px] rounded-full border border-primary/50 bg-gradient-primary px-7 py-5 text-primary-foreground shadow-glow"
          : "min-w-[128px] max-w-[220px] rounded-2xl border bg-card px-4 py-2.5 text-sm text-foreground shadow-soft"
      } ${selected ? "ring-2 ring-primary" : ""}`}
      style={!isRoot ? { borderColor: d.branchColor, backgroundColor: d.tintColor } : undefined}
      onClick={() => {
        if (selected && !editing) setEditing(true);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        setEditing(true);
      }}
    >
      {/* One source + target handle per side. Purely connection anchors —
          FloatingEdge computes the actual visual attachment point itself, so
          it doesn't matter which side a drag starts from. */}
      {HANDLE_POSITIONS.map((pos) => (
        <Fragment key={pos}>
          <Handle
            type="target"
            id={`t-${pos}`}
            position={pos}
            className={`!h-2 !w-2 !border-0 !bg-primary/60 transition-opacity ${
              selected ? "!opacity-90" : "!opacity-0 group-hover:!opacity-70"
            }`}
          />
          <Handle
            type="source"
            id={`s-${pos}`}
            position={pos}
            className={`!h-2 !w-2 !border-0 !bg-primary/60 transition-opacity ${
              selected ? "!opacity-90" : "!opacity-0 group-hover:!opacity-70"
            }`}
          />
        </Fragment>
      ))}

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
          className={`w-full resize-none bg-transparent text-center outline-none ${isRoot ? "font-display" : ""}`}
        />
      ) : (
        <div className={`whitespace-pre-wrap break-words leading-snug ${isRoot ? "font-display text-base" : ""}`}>
          {d.text}
        </div>
      )}

      <NodeToolbar
        isVisible={selected && !editing}
        position={Position.Bottom}
        offset={10}
        className="flex gap-1 rounded-full border border-border bg-popover/95 p-1 shadow-elegant backdrop-blur"
      >
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          title="Editar"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full text-primary-glow hover:bg-primary hover:text-primary-foreground"
          onClick={(e) => {
            e.stopPropagation();
            d.onAddChild();
          }}
          title="Adicionar ideia (Tab)"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        {!isRoot && (
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-full text-destructive hover:bg-destructive hover:text-destructive-foreground"
            onClick={(e) => {
              e.stopPropagation();
              d.onDelete();
            }}
            title="Excluir (Delete)"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </NodeToolbar>
    </div>
  );
}

export const MindNodeCard = memo(MindNodeCardBase);
