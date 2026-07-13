import { useState } from "react";
import { Plus, Check, Settings2, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function CreatableSelect({
  value,
  onChange,
  options,
  onCreate,
  customOptions,
  onRemove,
  onRename,
  placeholder = "Selecione",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onCreate: (v: string) => void;
  customOptions?: string[];
  onRemove?: (v: string) => void;
  onRename?: (oldValue: string, newValue: string) => void;
  placeholder?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const [managing, setManaging] = useState(false);
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const confirmCreate = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setCreating(false);
      return;
    }
    onCreate(trimmed);
    onChange(trimmed);
    setDraft("");
    setCreating(false);
  };

  const confirmRename = (oldValue: string) => {
    const trimmed = editDraft.trim();
    if (trimmed && trimmed !== oldValue) {
      onRename?.(oldValue, trimmed);
      if (value === oldValue) onChange(trimmed);
    }
    setEditingValue(null);
  };

  if (creating) {
    return (
      <div className="flex gap-2">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Nome da nova categoria"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              confirmCreate();
            }
            if (e.key === "Escape") setCreating(false);
          }}
        />
        <Button type="button" size="icon" onClick={confirmCreate} className="shrink-0">
          <Check className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Select
        value={value}
        onValueChange={(v) => (v === "__create__" ? setCreating(true) : onChange(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
          <SelectItem value="__create__" className="text-primary-glow">
            <span className="flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Nova categoria
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {customOptions && customOptions.length > 0 && (
        <Popover open={managing} onOpenChange={setManaging}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="shrink-0" title="Gerenciar categorias">
              <Settings2 className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 space-y-1">
            <p className="mb-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Suas categorias
            </p>
            {customOptions.map((o) =>
              editingValue === o ? (
                <div key={o} className="flex gap-1.5">
                  <Input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmRename(o);
                      if (e.key === "Escape") setEditingValue(null);
                    }}
                  />
                  <Button type="button" size="icon" className="h-8 w-8 shrink-0" onClick={() => confirmRename(o)}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div key={o} className="flex items-center justify-between gap-1.5 rounded-md px-2 py-1 text-sm hover:bg-secondary/40">
                  <span className="truncate">{o}</span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingValue(o);
                        setEditDraft(o);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove?.(o)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ),
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
