import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Network, Pencil, Copy, Trash2 } from "lucide-react";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { MindMapThumbnail } from "@/components/mindmap/MindMapThumbnail";
import { toast } from "sonner";

export default function MindMaps() {
  const navigate = useNavigate();
  const { mindmaps } = useUserData();
  const addMindmap = useAppStore((s) => s.addMindmap);
  const renameMindmap = useAppStore((s) => s.renameMindmap);
  const duplicateMindmap = useAppStore((s) => s.duplicateMindmap);
  const removeMindmap = useAppStore((s) => s.removeMindmap);
  const { requestDelete, dialog: confirmDialog } = useConfirmDelete();

  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = () => {
    const id = addMindmap("Novo mapa mental");
    navigate(`/mapas/${id}`);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Foco"
        title="Mapas mentais"
        description="Organize ideias num canvas livre. Arraste, conecte e expanda."
        action={
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo mapa mental
          </Button>
        }
      />

      {mindmaps.length === 0 ? (
        <div className="rounded-xl border border-border bg-card/40 p-12 text-center">
          <Network className="mx-auto mb-4 h-10 w-10 text-primary-glow" />
          <p className="font-display text-lg">Nenhum mapa ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie seu primeiro mapa mental para começar a desenhar ideias.
          </p>
          <Button onClick={handleCreate} className="mt-5 gap-2">
            <Plus className="h-4 w-4" />
            Criar mapa
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mindmaps.map((m) => (
            <div
              key={m.id}
              className="group flex flex-col rounded-xl border border-border bg-gradient-card p-5 transition-shadow hover:shadow-elegant"
            >
              <button
                onClick={() => navigate(`/mapas/${m.id}`)}
                className="flex items-start justify-between gap-3 text-left"
              >
                <div>
                  <div className="flex items-center gap-2 text-primary-glow">
                    <Network className="h-4 w-4" />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {m.nodes.length} {m.nodes.length === 1 ? "ideia" : "ideias"}
                    </span>
                  </div>
                  <h3 className="mt-2 font-display text-xl leading-tight">{m.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Criado em{" "}
                    {new Date(m.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
                <MindMapThumbnail nodes={m.nodes} />
              </button>

              <div className="mt-4 flex items-center gap-1 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => setRenameTarget({ id: m.id, name: m.name })}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => {
                    const nid = duplicateMindmap(m.id);
                    if (nid) toast.success("Mapa duplicado");
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto h-8 px-2 text-destructive hover:text-destructive"
                  onClick={() =>
                    requestDelete(
                      () => {
                        removeMindmap(m.id);
                        toast.success("Mapa excluído");
                      },
                      { title: `Excluir "${m.name}"?`, description: "Essa ação não pode ser desfeita." },
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={!!renameTarget}
        onOpenChange={(o) => !o && setRenameTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear mapa</DialogTitle>
          </DialogHeader>
          <Input
            value={renameTarget?.name ?? ""}
            onChange={(e) =>
              setRenameTarget((t) => (t ? { ...t, name: e.target.value } : t))
            }
            placeholder="Nome do mapa"
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (renameTarget) {
                  renameMindmap(renameTarget.id, renameTarget.name);
                  setRenameTarget(null);
                }
              }}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  );
}
