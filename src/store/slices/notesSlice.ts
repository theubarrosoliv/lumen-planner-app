import { StateCreator } from "zustand";
import { Note, NoteFolder } from "../types";
import { CoreState, mutate, uid } from "../core";

export interface NotesSlice {
  addNote: (folderId?: string) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content" | "folderId">>) => void;
  removeNote: (id: string) => void;
  addNoteFolder: (name: string) => string;
  renameNoteFolder: (id: string, name: string) => void;
  removeNoteFolder: (id: string) => void;
}

export const createNotesSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
  // addNote/addNoteFolder need to return the new id synchronously (the page
  // navigates straight into it), so they call persistAll() directly instead
  // of going through the void-returning `persist` wrapper — same pattern as
  // addMindmap in mindmapsSlice.ts.
  persistAll: () => void,
): StateCreator<CoreState & NotesSlice, [], [], NotesSlice> => (set) => ({
  addNote: (folderId) => {
    const id = uid();
    const now = new Date().toISOString();
    const note: Note = { id, folderId, title: "", content: "", createdAt: now, updatedAt: now };
    set((s) => mutate(s, (d) => ({ ...d, notes: [...d.notes, note] })));
    persistAll();
    return id;
  },

  updateNote: persist((id: string, patch: Partial<Pick<Note, "title" | "content" | "folderId">>) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        notes: d.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)),
      })),
    ),
  ),

  removeNote: persist((id: string) =>
    set((s) => mutate(s, (d) => ({ ...d, notes: d.notes.filter((n) => n.id !== id) }))),
  ),

  addNoteFolder: (name) => {
    const id = uid();
    const folder: NoteFolder = { id, name: name.trim() || "Nova pasta", createdAt: new Date().toISOString() };
    set((s) => mutate(s, (d) => ({ ...d, noteFolders: [...d.noteFolders, folder] })));
    persistAll();
    return id;
  },

  renameNoteFolder: persist((id: string, name: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        noteFolders: d.noteFolders.map((f) => (f.id === id ? { ...f, name: name.trim() || f.name } : f)),
      })),
    ),
  ),

  // Deleting a folder ungroups its notes rather than deleting them — losing
  // written notes because their folder was removed would be a nasty surprise.
  removeNoteFolder: persist((id: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        noteFolders: d.noteFolders.filter((f) => f.id !== id),
        notes: d.notes.map((n) => (n.folderId === id ? { ...n, folderId: undefined } : n)),
      })),
    ),
  ),
});
