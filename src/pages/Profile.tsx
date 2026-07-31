import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SectionHeader } from "@/components/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppStore } from "@/store/useAppStore";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import { toast } from "sonner";

export default function Profile() {
  const navigate = useNavigate();
  const user = useAppStore((s) => s.currentUser());
  const updateProfileName = useAppStore((s) => s.updateProfileName);
  const deleteAccount = useAppStore((s) => s.deleteAccount);
  const { requestDelete, dialog } = useConfirmDelete();

  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const save = async () => {
    setSaving(true);
    const res = await updateProfileName(name);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error ?? "Algo deu errado");
      return;
    }
    toast.success("Nome atualizado");
  };

  const confirmDeleteAccount = () => {
    requestDelete(
      async () => {
        setDeleting(true);
        const res = await deleteAccount();
        setDeleting(false);
        if (!res.ok) {
          toast.error(res.error ?? "Algo deu errado");
          return;
        }
        toast.success("Conta excluída");
        navigate("/auth", { replace: true });
      },
      {
        title: "Excluir sua conta?",
        description:
          "Isso apaga permanentemente sua conta e todos os seus dados — tarefas, hábitos, metas, projetos, eventos e mapas mentais. Essa ação não pode ser desfeita.",
      },
    );
  };

  return (
    <div className="mx-auto max-w-2xl">
      <SectionHeader
        eyebrow="Perfil"
        title="Sua conta."
        description="Dados da conta e opções de gerenciamento."
      />

      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-gradient-card p-6">
          <h2 className="font-display text-xl">Dados pessoais</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Nome
              </Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Como podemos te chamar?"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-[0.2em] text-muted-foreground">E-mail</Label>
              <Input value={user?.email ?? ""} disabled readOnly />
            </div>
            <Button
              onClick={save}
              disabled={saving || !name.trim() || name.trim() === user?.name}
              className="bg-gradient-primary shadow-elegant"
            >
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-destructive/30 bg-gradient-card p-6">
          <h2 className="font-display text-xl text-destructive">Excluir conta</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Remove sua conta e todos os seus dados permanentemente. Não é possível desfazer.
          </p>
          <Button
            variant="outline"
            onClick={confirmDeleteAccount}
            disabled={deleting}
            className="mt-4 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {deleting ? "Excluindo…" : "Excluir conta"}
          </Button>
        </div>
      </div>
      {dialog}
    </div>
  );
}
