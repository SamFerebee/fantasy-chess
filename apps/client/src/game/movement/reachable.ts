import type { BoardConfig } from "../board/BoardConfig";
import { isTileEnabled } from "../board/iso";

export type Tile = { x: number; y: number };

function key(x: number, y: number) {
  return `${x},${y}`;
}

export function computeReachableTiles(args: {
  cfg: BoardConfig;
  start: Tile;
  moveRange: number;
  blocked: Set<string>; // keys "x,y" that cannot be entered
}): Tile[] {
  const cfg = args.cfg;

  const q: Array<{ x: number; y: number; d: number }> = [];
  const seen = new Set<string>();
  const out: Tile[] = [];

  q.push({ x: args.start.x, y: args.start.y, d: 0 });
  seen.add(key(args.start.x, args.start.y));

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (q.length) {
    const cur = q.shift()!;
    out.push({ x: cur.x, y: cur.y });

    if (cur.d >= args.moveRange) continue;

    for (const dir of dirs) {
      const nx = cur.x + dir.dx;
      const ny = cur.y + dir.dy;
      const k = key(nx, ny);

      if (seen.has(k)) continue;
      if (!isTileEnabled(nx, ny, cfg)) continue;

      // allow standing on start tile even if "blocked"
      if (nx !== args.start.x || ny !== args.start.y) {
        if (args.blocked.has(k)) continue;
      }

      seen.add(k);
      q.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }

  // Exclude the start tile if you don’t want it highlighted; keep it for now.
  return out;
}
