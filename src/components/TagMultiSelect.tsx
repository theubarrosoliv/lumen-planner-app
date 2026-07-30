import { useState } from "react";
import { Check, Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function TagMultiSelect({
  value,
  onChange,
  options,
  onCreate,
  customOptions,
  onRemove,
  onRename,
  placeholder = "Tags",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
  onCreate: (v: string) => void;
  customOptions?: string[];
  onRemove?: (v: string) => void;
  onRename?: (oldValue: string, newValue: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const toggle = (o: string) => {
    onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o]);
  };

  const confirmCreate = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (!options.includes(trimmed)) onCreate(trimmed);
    if (!value.includes(trimmed)) onChange([...value, trimmed]);
    setDraft("");
  };

  const confirmRename = (oldValue: string) => {
    const trimmed = editDraft.trim();
    if (trimmed && trimmed !== oldValue) {
      onRename?.(oldValue, trimmed);
      onChange(value.map((v) => (v === oldValue ? trimmed : v)));
    }
    setEditingValue(null);
  };

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap gap-1.5">
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground/60">Nenhuma tag selecionada</span>
        )}
        {value.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-primary-glow"
          >
            {v}
            <button type="button" onClick={() => toggle(v)} className="hover:text-destructive">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> {placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 space-y-1">
          <div className="flex gap-1.5">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Nova tag…"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirmCreate();
                }
              }}
            />
            <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={confirmCreate}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="max-h-56 space-y-0.5 overflow-y-auto pt-1">
            {options.map((o) =>
              editingValue === o ? (
                <div key={o} className="flex gap-1.5">
                  <Input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(o);
                      if (e.key === "Escape") setEditingValue(null);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => confirmRename(o)}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div
                  key={o}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary/40",
                    value.includes(o) && "bg-secondary/40",
                  )}
                  onClick={() => toggle(o)}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        value.includes(o) ? "border-primary bg-gradient-primary" : "border-border",
                      )}
                    >
                      {value.includes(o) && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                    </span>
                    {o}
                  </span>
                  {customOptions?.includes(o) && (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingValue(o);
                          setEditDraft(o);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove?.(o);
                          onChange(value.filter((v) => v !== o));
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
