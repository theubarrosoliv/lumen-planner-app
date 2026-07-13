import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * A <Select> that also lets the user type a brand-new option inline
 * ("+ Nova categoria") instead of being limited to a fixed list.
 */
export function CreatableSelect({
  value,
  onChange,
  options,
  onCreate,
  placeholder = "Selecione",
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  onCreate: (v: string) => void;
  placeholder?: string;
}) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");

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
  );
}
