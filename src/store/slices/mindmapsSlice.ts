import { StateCreator } from "zustand";
import { MindEdge, MindMap, MindNode } from "../types";
import { CoreState, mutate, uid } from "../core";

export interface MindmapsSlice {
  addMindmap: (name: string) => string;
  renameMindmap: (id: string, name: string) => void;
  duplicateMindmap: (id: string) => string | null;
  removeMindmap: (id: string) => void;
  setMindmapGraph: (
    id: string,
    patch: { nodes?: MindNode[]; edges?: MindEdge[]; viewport?: { x: number; y: number; zoom: number } },
  ) => void;
}

export const createMindmapsSlice = (
  persist: <T extends unknown[]>(fn: (...a: T) => void) => (...a: T) => void,
  // addMindmap/duplicateMindmap need to return a value synchronously, so they
  // call persistAll() directly instead of going through the void-returning `persist` wrapper.
  persistAll: () => void,
): StateCreator<CoreState & MindmapsSlice, [], [], MindmapsSlice> => (set) => ({
  addMindmap: (name) => {
    const id = uid();
    const rootId = uid();
    const map: MindMap = {
      id,
      name: name.trim() || "Novo mapa mental",
      createdAt: new Date().toISOString(),
      nodes: [{ id: rootId, text: "Ideia central", x: 0, y: 0 }],
      edges: [],
    };
    set((s) => mutate(s, (d) => ({ ...d, mindmaps: [...(d.mindmaps ?? []), map] })));
    persistAll();
    return id;
  },

  renameMindmap: persist((id: string, name: string) =>
    set((s) =>
      mutate(s, (d) => ({
        ...d,
        mindmaps: (d.mindmaps ?? []).map((m) =>
          m.id === id ? { ...m, name: name.trim() || m.name } : m,
        ),
      })),
    ),
  ),

  duplicateMindmap: (id) => {
    let newId: string | null = null;
    set((s) =>
      mutate(s, (d) => {
        const src = (d.mindmaps ?? []).find((m) => m.id === id);
        if (!src) return d;
        newId = uid();
        const idMap = new Map<string, string>();
        const nodes = src.nodes.map((n) => {
          const nid = uid();
          idMap.set(n.id, nid);
          return { ...n, id: nid };
        });
        const remappedNodes = nodes.map((n) => ({
          ...n,
          parentId: n.parentId ? idMap.get(n.parentId) : undefined,
        }));
        const edges = src.edges.map((e) => ({
          id: uid(),
          from: idMap.get(e.from) ?? e.from,
          to: idMap.get(e.to) ?? e.to,
        }));
        return {
          ...d,
          mindmaps: [
            ...(d.mindmaps ?? []),
            {
              ...src,
              id: newId!,
              name: `${src.name} (cópia)`,
              createdAt: new Date().toISOString(),
              nodes: remappedNodes,
              edges,
            },
          ],
        };
      }),
    );
    persistAll();
    return newId;
  },

  removeMindmap: persist((id: string) =>
    set((s) =>
      mutate(s, (d) => ({ ...d, mindmaps: (d.mindmaps ?? []).filter((m) => m.id !== id) })),
    ),
  ),

  setMindmapGraph: persist(
    (
      id: string,
      patch: { nodes?: MindNode[]; edges?: MindEdge[]; viewport?: { x: number; y: number; zoom: number } },
    ) =>
      set((s) =>
        mutate(s, (d) => ({
          ...d,
          mindmaps: (d.mindmaps ?? []).map((m) =>
            m.id === id
              ? {
                  ...m,
                  nodes: patch.nodes ?? m.nodes,
                  edges: patch.edges ?? m.edges,
                  viewport: patch.viewport ?? m.viewport,
                }
              : m,
          ),
        })),
      ),
  ),
});
