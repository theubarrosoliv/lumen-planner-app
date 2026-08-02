import { BaseEdge, EdgeProps, InternalNode, useInternalNode } from "@xyflow/react";

/**
 * Ray-rectangle intersection from a node's center toward `dx,dy` — lets an
 * edge attach wherever a node's border actually faces the other node,
 * instead of a fixed handle point. Needed because nodes now radiate in every
 * direction around the hub, not just up/down a flowchart column.
 */
function borderPoint(node: InternalNode, dx: number, dy: number) {
  const width = node.measured.width ?? 160;
  const height = node.measured.height ?? 48;
  const cx = node.internals.positionAbsolute.x + width / 2;
  const cy = node.internals.positionAbsolute.y + height / 2;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const scaleX = dx !== 0 ? width / 2 / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? height / 2 / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

/**
 * Floating edge: computes its own endpoints every render from live node
 * geometry (rather than a fixed handle position) and bows slightly off the
 * straight line between them, so branches read as organic hand-drawn arcs
 * radiating from the hub instead of ruler-straight spokes or right-angled
 * flowchart connectors.
 */
export function FloatingEdge({ id, source, target, style, markerEnd }: EdgeProps) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const sw = sourceNode.measured.width ?? 160;
  const sh = sourceNode.measured.height ?? 48;
  const tw = targetNode.measured.width ?? 160;
  const th = targetNode.measured.height ?? 48;
  const scx = sourceNode.internals.positionAbsolute.x + sw / 2;
  const scy = sourceNode.internals.positionAbsolute.y + sh / 2;
  const tcx = targetNode.internals.positionAbsolute.x + tw / 2;
  const tcy = targetNode.internals.positionAbsolute.y + th / 2;
  const dx = tcx - scx;
  const dy = tcy - scy;

  const from = borderPoint(sourceNode, dx, dy);
  const to = borderPoint(targetNode, -dx, -dy);

  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const nx = -dy;
  const ny = dx;
  const len = Math.hypot(nx, ny) || 1;
  const bow = Math.min(28, Math.hypot(dx, dy) * 0.12);
  const cx = mx + (nx / len) * bow;
  const cy = my + (ny / len) * bow;
  const path = `M ${from.x},${from.y} Q ${cx},${cy} ${to.x},${to.y}`;

  return <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} />;
}
