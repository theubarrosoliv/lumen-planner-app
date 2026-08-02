import { MindNode } from "@/store/types";

/**
 * Mind-map-specific layout & branch-color helpers. Nodes radiate outward
 * from the root like a real mind map — phyllotaxis-style fan for new
 * branches, angular subdivision (by leaf count) for a full re-layout —
 * instead of the flowchart-style fixed offset the editor used before.
 */

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°, never overlaps regardless of count
const ROOT_RING = 200;
const RING_STEP = 170;
const SIBLING_FAN = (26 * Math.PI) / 180;

function byIdMap(nodes: MindNode[]): Map<string, MindNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function findRoot(nodes: MindNode[]): MindNode | undefined {
  return nodes.find((n) => !n.parentId);
}

/** Where a brand-new child of `parentId` should first appear — radiating
 * outward from the hub instead of always spawning to the right. */
export function nextChildPosition(parentId: string, nodes: MindNode[]): { x: number; y: number } {
  const byId = byIdMap(nodes);
  const parent = byId.get(parentId);
  const root = findRoot(nodes);
  if (!parent || !root) return { x: 0, y: 0 };
  const siblingCount = nodes.filter((n) => n.parentId === parentId).length;

  if (parent.id === root.id) {
    // Direct branch off the hub: golden-angle spacing so branches fan out
    // around the whole circle and never land on top of one another, no
    // matter how many already exist.
    const angle = siblingCount * GOLDEN_ANGLE;
    return { x: root.x + Math.cos(angle) * ROOT_RING, y: root.y + Math.sin(angle) * ROOT_RING };
  }

  // Descendant: keep radiating outward along the same ray as its parent,
  // fanning alternately left/right per additional sibling — like twigs
  // spreading off a branch instead of stacking on the same line.
  const parentAngle = Math.atan2(parent.y - root.y, parent.x - root.x);
  const half = Math.ceil(siblingCount / 2);
  const sign = siblingCount % 2 === 0 ? 1 : -1;
  const angle = siblingCount === 0 ? parentAngle : parentAngle + sign * half * SIBLING_FAN;
  const parentRadius = Math.hypot(parent.x - root.x, parent.y - root.y);
  const radius = parentRadius + RING_STEP;
  return { x: root.x + Math.cos(angle) * radius, y: root.y + Math.sin(angle) * radius };
}

function leafCount(id: string, childrenOf: Map<string, MindNode[]>): number {
  const kids = childrenOf.get(id);
  if (!kids || kids.length === 0) return 1;
  return kids.reduce((sum, k) => sum + leafCount(k.id, childrenOf), 0);
}

/**
 * Full re-layout: every node radiates from the root in a wedge sized to how
 * many leaves it carries — a real radial mind-map layout, not a flowchart
 * column. Root keeps its current position so "Reorganizar" doesn't yank the
 * canvas away from wherever the user has it panned to.
 */
export function radialAutoLayout(nodes: MindNode[]): MindNode[] {
  const root = findRoot(nodes);
  if (!root) return nodes;
  const childrenOf = new Map<string, MindNode[]>();
  for (const n of nodes) {
    if (!n.parentId) continue;
    const list = childrenOf.get(n.parentId) ?? [];
    list.push(n);
    childrenOf.set(n.parentId, list);
  }

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(root.id, { x: root.x, y: root.y });

  const place = (id: string, angleStart: number, angleEnd: number, depth: number) => {
    const kids = childrenOf.get(id);
    if (!kids || kids.length === 0) return;
    const total = kids.reduce((sum, k) => sum + leafCount(k.id, childrenOf), 0);
    const radius = ROOT_RING + RING_STEP * (depth - 1);
    let cursor = angleStart;
    for (const kid of kids) {
      const share = ((angleEnd - angleStart) * leafCount(kid.id, childrenOf)) / total;
      const mid = cursor + share / 2;
      positions.set(kid.id, {
        x: root.x + Math.cos(mid) * radius,
        y: root.y + Math.sin(mid) * radius,
      });
      place(kid.id, cursor, cursor + share, depth + 1);
      cursor += share;
    }
  };

  place(root.id, 0, Math.PI * 2, 1);

  return nodes.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });
}

/** `id` plus every descendant — for deleting a whole subtree in one go. */
export function subtreeIds(id: string, nodes: MindNode[]): Set<string> {
  const toRemove = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
        toRemove.add(n.id);
        changed = true;
      }
    }
  }
  return toRemove;
}

/** Distance (in edges) from the root; the root itself is depth 0. */
export function nodeDepth(id: string, nodes: MindNode[]): number {
  const byId = byIdMap(nodes);
  let depth = 0;
  let cur = byId.get(id);
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId.get(cur.parentId);
    depth++;
  }
  return depth;
}

/**
 * Which of the root's direct children this node's branch descends from —
 * null for the root itself. Drives the per-branch color-coding real
 * mind-mapping tools use so the eye can group descendants at a glance.
 */
export function branchIndexFor(id: string, nodes: MindNode[]): number | null {
  const byId = byIdMap(nodes);
  const node = byId.get(id);
  const root = findRoot(nodes);
  if (!node || !root || !node.parentId) return null;
  const rootChildren = nodes.filter((n) => n.parentId === root.id);
  let cur = node;
  const seen = new Set<string>();
  while (cur.parentId !== root.id) {
    const parent = cur.parentId ? byId.get(cur.parentId) : undefined;
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    cur = parent;
  }
  const idx = rootChildren.findIndex((n) => n.id === cur.id);
  return idx === -1 ? 0 : idx;
}

/**
 * Muted, warm hues that stay in the app's restrained "graphite & gold"
 * register — companions to the gold primary, not a rainbow. Index 0 mirrors
 * the primary gold so a single-branch map still reads as fully on-brand.
 */
const BRANCH_HUES = [
  { h: 42, s: 70, l: 46 },
  { h: 16, s: 55, l: 50 },
  { h: 152, s: 26, l: 40 },
  { h: 206, s: 42, l: 52 },
  { h: 282, s: 26, l: 55 },
  { h: 350, s: 38, l: 56 },
];

export function branchHsl(index: number, alpha = 1): string {
  const c = BRANCH_HUES[index % BRANCH_HUES.length];
  return `hsl(${c.h} ${c.s}% ${c.l}% / ${alpha})`;
}
