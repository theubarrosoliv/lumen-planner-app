import { MindNode } from "@/store/types";
import { branchHsl, branchIndexFor, findRoot } from "@/lib/mindmapLayout";

const SIZE = 64;
const PAD = 10;

/**
 * Tiny live preview of a mind map's actual shape — same branch colors and
 * relative positions as the real canvas — instead of a plain node-count
 * label. Lets browsing the map list feel like flipping through little
 * constellations rather than a generic file list.
 */
export function MindMapThumbnail({ nodes }: { nodes: MindNode[] }) {
  if (nodes.length === 0) return null;
  const root = findRoot(nodes) ?? nodes[0];

  if (nodes.length === 1) {
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-14 w-14 shrink-0">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={4} fill="hsl(var(--primary))" />
      </svg>
    );
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const span = Math.max(rangeX, rangeY);
  const offsetX = (span - rangeX) / 2;
  const offsetY = (span - rangeY) / 2;

  const project = (n: MindNode) => ({
    x: PAD + ((n.x - minX + offsetX) / span) * (SIZE - PAD * 2),
    y: PAD + ((n.y - minY + offsetY) / span) * (SIZE - PAD * 2),
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-14 w-14 shrink-0 opacity-90">
      {nodes
        .filter((n) => n.parentId && byId.get(n.parentId))
        .map((n) => {
          const p = project(n);
          const parent = byId.get(n.parentId!)!;
          const pp = project(parent);
          const idx = branchIndexFor(n.id, nodes);
          return (
            <line
              key={n.id}
              x1={pp.x}
              y1={pp.y}
              x2={p.x}
              y2={p.y}
              stroke={idx === null ? "hsl(var(--primary) / 0.35)" : branchHsl(idx, 0.4)}
              strokeWidth={1}
            />
          );
        })}
      {nodes.map((n) => {
        const p = project(n);
        const isRoot = n.id === root.id;
        const idx = branchIndexFor(n.id, nodes);
        return (
          <circle
            key={n.id}
            cx={p.x}
            cy={p.y}
            r={isRoot ? 4 : 2.25}
            fill={isRoot || idx === null ? "hsl(var(--primary))" : branchHsl(idx, 0.9)}
          />
        );
      })}
    </svg>
  );
}
