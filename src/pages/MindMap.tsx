import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Background,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeChange,
  ReactFlow,
  ReactFlowProvider,
  Viewport,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ArrowLeft, Plus, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAppStore, useUserData } from "@/store/useAppStore";
import { MindEdge, MindMap as MindMapType, MindNode } from "@/store/types";
import { MindNodeCard, MindNodeData } from "@/components/mindmap/MindNodeCard";
import { FloatingEdge } from "@/components/mindmap/FloatingEdge";
import { useConfirmDelete } from "@/hooks/use-confirm-delete";
import {
  branchHsl,
  branchIndexFor,
  nextChildPosition,
  nodeDepth,
  radialAutoLayout,
  subtreeIds,
} from "@/lib/mindmapLayout";

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const nodeTypes = { mind: MindNodeCard };
const edgeTypes = { floating: FloatingEdge };

function Editor({ mindmap }: { mindmap: MindMapType }) {
  const navigate = useNavigate();
  const setMindmapGraph = useAppStore((s) => s.setMindmapGraph);
  const renameMindmap = useAppStore((s) => s.renameMindmap);
  const flow = useReactFlow();
  const { requestDelete, dialog: confirmDialog } = useConfirmDelete();

  const [name, setName] = useState(mindmap.name);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Local graph state mirrors store; we persist on changes.
  const [nodesState, setNodesState] = useState<MindNode[]>(mindmap.nodes);
  const [edgesState, setEdgesState] = useState<MindEdge[]>(mindmap.edges);
  const rootIdRef = useRef<string>(mindmap.nodes[0]?.id ?? "");

  useEffect(() => {
    setNodesState(mindmap.nodes);
    setEdgesState(mindmap.edges);
    rootIdRef.current = mindmap.nodes.find((n) => !n.parentId)?.id ?? mindmap.nodes[0]?.id ?? "";
  }, [mindmap.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist (debounced microtask)
  const persistRef = useRef<number | null>(null);
  const persist = useCallback(
    (nodes: MindNode[], edges: MindEdge[], viewport?: Viewport) => {
      if (persistRef.current) window.clearTimeout(persistRef.current);
      persistRef.current = window.setTimeout(() => {
        setMindmapGraph(mindmap.id, { nodes, edges, viewport });
      }, 200);
    },
    [mindmap.id, setMindmapGraph],
  );

  const updateNodeText = useCallback(
    (id: string, text: string) => {
      setNodesState((prev) => {
        const next = prev.map((n) => (n.id === id ? { ...n, text } : n));
        persist(next, edgesState);
        return next;
      });
    },
    [edgesState, persist],
  );

  const addChild = useCallback(
    (parentId: string) => {
      const parent = nodesState.find((n) => n.id === parentId);
      if (!parent) return;
      const pos = nextChildPosition(parentId, nodesState);
      const newNode: MindNode = {
        id: uid(),
        text: "Nova ideia",
        x: pos.x,
        y: pos.y,
        parentId: parent.id,
      };
      const nextNodes = [...nodesState, newNode];
      setNodesState(nextNodes);
      persist(nextNodes, edgesState);
      setSelectedId(newNode.id);
    },
    [nodesState, edgesState, persist],
  );

  const reorganize = useCallback(() => {
    const next = radialAutoLayout(nodesState);
    setNodesState(next);
    persist(next, edgesState);
    requestAnimationFrame(() => flow.fitView({ duration: 450, padding: 0.25 }));
  }, [nodesState, edgesState, persist, flow]);

  const deleteNode = useCallback(
    (id: string) => {
      if (id === rootIdRef.current) return;
      const toRemove = subtreeIds(id, nodesState);
      const node = nodesState.find((n) => n.id === id);
      requestDelete(
        () => {
          const nextNodes = nodesState.filter((n) => !toRemove.has(n.id));
          const nextEdges = edgesState.filter(
            (e) => !toRemove.has(e.from) && !toRemove.has(e.to),
          );
          setNodesState(nextNodes);
          setEdgesState(nextEdges);
          persist(nextNodes, nextEdges);
          setSelectedId(null);
        },
        {
          title: `Excluir "${node?.text ?? "ideia"}"?`,
          description:
            toRemove.size > 1
              ? `Isso também exclui ${toRemove.size - 1} ${
                  toRemove.size - 1 === 1 ? "ideia conectada" : "ideias conectadas"
                } abaixo dela.`
              : "Essa ação não pode ser desfeita.",
        },
      );
    },
    [nodesState, edgesState, persist, requestDelete],
  );

  // Build React Flow nodes/edges
  const rfNodes: Node<MindNodeData>[] = useMemo(
    () =>
      nodesState.map((n) => {
        const isRoot = n.id === rootIdRef.current;
        const branchIdx = branchIndexFor(n.id, nodesState);
        const depth = nodeDepth(n.id, nodesState);
        const ringAlpha = Math.max(0.28, 0.85 - (depth - 1) * 0.18);
        const tintAlpha = Math.max(0.05, 0.14 - (depth - 1) * 0.03);
        return {
          id: n.id,
          type: "mind",
          position: { x: n.x, y: n.y },
          selected: selectedId === n.id,
          data: {
            text: n.text,
            isRoot,
            branchColor: branchIdx !== null ? branchHsl(branchIdx, ringAlpha) : undefined,
            tintColor: branchIdx !== null ? branchHsl(branchIdx, tintAlpha) : undefined,
            onTextChange: (t: string) => updateNodeText(n.id, t),
            onAddChild: () => addChild(n.id),
            onDelete: () => deleteNode(n.id),
          },
        };
      }),
    [nodesState, selectedId, updateNodeText, addChild, deleteNode],
  );

  const rfEdges: Edge[] = useMemo(() => {
    const parentEdges: Edge[] = nodesState
      .filter((n) => n.parentId)
      .map((n) => {
        const depth = nodeDepth(n.id, nodesState);
        const branchIdx = branchIndexFor(n.id, nodesState);
        const width = Math.max(1.25, 2.75 - (depth - 1) * 0.35);
        const alpha = Math.max(0.3, 0.75 - (depth - 1) * 0.14);
        return {
          id: `p-${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id,
          type: "floating",
          animated: false,
          style: {
            stroke: branchIdx !== null ? branchHsl(branchIdx, alpha) : "hsl(var(--primary) / 0.6)",
            strokeWidth: width,
          },
        };
      });
    const extraEdges: Edge[] = edgesState.map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      type: "floating",
      style: { stroke: "hsl(var(--primary-glow) / 0.7)", strokeWidth: 1.5, strokeDasharray: "4 4" },
    }));
    return [...parentEdges, ...extraEdges];
  }, [nodesState, edgesState]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const updated = applyNodeChanges(changes, rfNodes);
      // sync positions back to mindNodes
      const posMap = new Map(updated.map((n) => [n.id, n.position]));
      const selChange = changes.find((c) => c.type === "select");
      if (selChange && "id" in selChange) {
        setSelectedId(selChange.selected ? (selChange.id as string) : null);
      }
      const hasPosChange = changes.some((c) => c.type === "position");
      if (hasPosChange) {
        setNodesState((prev) => {
          const next = prev.map((n) => {
            const p = posMap.get(n.id);
            return p ? { ...n, x: p.x, y: p.y } : n;
          });
          persist(next, edgesState);
          return next;
        });
      }
    },
    [rfNodes, edgesState, persist],
  );

  const onConnect = useCallback(
    (params: { source: string | null; target: string | null }) => {
      if (!params.source || !params.target || params.source === params.target) return;
      // Avoid duplicates of the parent-child edge
      const isParentChild = nodesState.some(
        (n) => n.parentId === params.source && n.id === params.target,
      );
      if (isParentChild) return;
      const exists = edgesState.some(
        (e) => e.from === params.source && e.to === params.target,
      );
      if (exists) return;
      const nextEdges = [
        ...edgesState,
        { id: uid(), from: params.source, to: params.target },
      ];
      setEdgesState(nextEdges);
      persist(nodesState, nextEdges);
    },
    [nodesState, edgesState, persist],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      // Only allow removing extra edges (parent edges have id starting with "p-")
      if (edge.id.startsWith("p-")) return;
      requestDelete(
        () => {
          const nextEdges = edgesState.filter((e) => e.id !== edge.id);
          setEdgesState(nextEdges);
          persist(nodesState, nextEdges);
        },
        { title: "Remover esta conexão?", description: "Essa ação não pode ser desfeita." },
      );
    },
    [nodesState, edgesState, persist, requestDelete],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (!selectedId) return;
      if (e.key === "Tab") {
        e.preventDefault();
        addChild(selectedId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteNode(selectedId);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, addChild, deleteNode]);

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/mapas")}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Mapas
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => renameMindmap(mindmap.id, name)}
          className="max-w-xs font-display text-lg"
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1"
          onClick={reorganize}
          title="Reorganiza as ideias ao redor da ideia central"
        >
          <Wand2 className="h-4 w-4" />
          Reorganizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto gap-1"
          onClick={() => addChild(selectedId ?? rootIdRef.current)}
        >
          <Plus className="h-4 w-4" />
          Nova ideia
        </Button>
      </div>

      <div className="flex-1 overflow-hidden rounded-xl border border-border bg-gradient-card">
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          onNodeClick={(_, n) => setSelectedId(n.id)}
          onPaneClick={() => setSelectedId(null)}
          defaultViewport={mindmap.viewport ?? { x: 0, y: 0, zoom: 1 }}
          onMoveEnd={(_, vp) => persist(nodesState, edgesState, vp)}
          fitView={!mindmap.viewport}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background gap={24} size={1} color="hsl(var(--border))" />
          <Controls className="!rounded-xl !border-border !bg-card !shadow-soft" />
          <MiniMap
            pannable
            zoomable
            className="!rounded-xl !border-border !bg-card !shadow-soft"
            nodeColor={() => "hsl(var(--primary) / 0.6)"}
            maskColor="hsl(var(--background) / 0.75)"
          />
        </ReactFlow>
      </div>
      {confirmDialog}
    </div>
  );
}

export default function MindMapPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mindmaps } = useUserData();
  const mindmap = mindmaps.find((m) => m.id === id);

  useEffect(() => {
    if (!mindmap) navigate("/mapas", { replace: true });
  }, [mindmap, navigate]);

  if (!mindmap) return null;

  return (
    <ReactFlowProvider>
      <Editor mindmap={mindmap} />
    </ReactFlowProvider>
  );
}
