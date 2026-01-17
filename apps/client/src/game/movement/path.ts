export type TileCoord = { x: number; y: number };

function key(t: TileCoord): string {
  return `${t.x},${t.y}`;
}

function parseKey(k: string): TileCoord {
  const [x, y] = k.split(",").map(Number);
  return { x, y };
}

export type ShortestPathOpts = {
  // Hard bounds check (board silhouette + edges).
  inBounds: (t: TileCoord) => boolean;

  // True if tile cannot be stepped onto (occupied, wall, etc).
  isBlocked: (t: TileCoord) => boolean;

  // Optional: if provided, BFS will not explore beyond this distance.
  maxSteps?: number;

  // Optional: constrain exploration to a precomputed reachable set.
  // If provided, nodes not in this set are ignored.
  reachableKeys?: Set<string>;
};

/**
 * 4-way BFS shortest path. Returns [start..goal] or null if unreachable.
 */
export function shortestPath4(
  start: TileCoord,
  goal: TileCoord,
  opts: ShortestPathOpts
): TileCoord[] | null {
  const startK = key(start);
  const goalK = key(goal);

  if (startK === goalK) return [start];
  if (!opts.inBounds(start) || !opts.inBounds(goal)) return null;
  if (opts.isBlocked(goal)) return null;

  if (opts.reachableKeys) {
    if (!opts.reachableKeys.has(goalK)) return null;
    if (!opts.reachableKeys.has(startK)) return null;
  }

  const q: TileCoord[] = [start];
  const cameFrom = new Map<string, string>(); // childKey -> parentKey
  const dist = new Map<string, number>();
  cameFrom.set(startK, ""); // sentinel
  dist.set(startK, 0);

  while (q.length) {
    const cur = q.shift()!;
    const curK = key(cur);
    const curD = dist.get(curK)!;

    if (opts.maxSteps != null && curD >= opts.maxSteps) continue;

    const neighbors: TileCoord[] = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const n of neighbors) {
      const nK = key(n);
      if (cameFrom.has(nK)) continue;

      if (!opts.inBounds(n)) continue;
      if (opts.reachableKeys && !opts.reachableKeys.has(nK)) continue;
      if (opts.isBlocked(n)) continue;

      cameFrom.set(nK, curK);
      dist.set(nK, curD + 1);

      if (nK === goalK) {
        // Reconstruct
        const out: TileCoord[] = [goal];
        let k = goalK;
        while (k !== startK) {
          const p = cameFrom.get(k);
          if (!p) return null;
          k = p;
          out.push(parseKey(k));
        }
        out.reverse();
        return out;
      }

      q.push(n);
    }
  }

  return null;
}

export function tileKey(t: TileCoord): string {
  return key(t);
}
