/** Parses "HH:MM" into minutes since midnight; "—"/undefined/malformed → null (no-time item). */
export function timeToMinutes(time?: string): number | null {
  if (!time || time === "—") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export interface TimedBlock {
  id: string;
  start: number; // minutes since midnight
  end: number; // minutes since midnight
}

/**
 * Assigns a side-by-side column to every overlapping block, like a day-view
 * calendar. Greedy interval-graph coloring: blocks are swept in start order,
 * each claiming the first column whose previous occupant has already ended;
 * every block in a connected overlap cluster shares that cluster's column
 * count so widths stay consistent across the whole cluster.
 */
export function layoutTimeline<T extends TimedBlock>(
  items: T[],
): (T & { col: number; cols: number })[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: (T & { col: number; cols: number })[] = [];

  let cluster: (T & { col: number })[] = [];
  let clusterEnd = -Infinity;
  let colEnds: number[] = [];

  const flush = () => {
    if (cluster.length === 0) return;
    const cols = Math.max(...cluster.map((c) => c.col)) + 1;
    for (const c of cluster) result.push({ ...c, cols });
    cluster = [];
  };

  for (const item of sorted) {
    if (item.start >= clusterEnd) {
      flush();
      colEnds = [];
      clusterEnd = -Infinity;
    }
    let col = colEnds.findIndex((end) => end <= item.start);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(item.end);
    } else {
      colEnds[col] = item.end;
    }
    cluster.push({ ...item, col });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();

  return result;
}
