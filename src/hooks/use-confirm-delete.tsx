import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Shared "are you sure?" gate for destructive actions. Edit/delete buttons
 * are always-visible on mobile (no hover to guard against a stray tap), so
 * every delete across the app confirms before it fires instead of running
 * immediately on click.
 */
export function useConfirmDelete() {
  const [pending, setPending] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const requestDelete = (
    onConfirm: () => void,
    opts?: { title?: string; description?: string },
  ) => {
    setPending({
      title: opts?.title ?? "Excluir?",
      description: opts?.description ?? "Essa ação não pode ser desfeita.",
      onConfirm,
    });
  };

  const dialog = (
    <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title}</AlertDialogTitle>
          <AlertDialogDescription>{pending?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              pending?.onConfirm();
              setPending(null);
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { requestDelete, dialog };
}
