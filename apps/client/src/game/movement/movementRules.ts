import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "./path";

export function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export function isInBoundsAndNotCutout(x: number, y: number, cfg: BoardConfig): boolean {
  if (x < 0 || y < 0 || x >= cfg.cols || y >= cfg.rows) return false;

  const c = cfg.cornerCut;
  if (c > 0) {
    const maxX = cfg.cols - 1;
    const maxY = cfg.rows - 1;

    const inTL = x < c && y < c;
    const inTR = x > maxX - c && y < c;
    const inBL = x < c && y > maxY - c;
    const inBR = x > maxX - c && y > maxY - c;

    if (inTL || inTR || inBL || inBR) return false;
  }

  return true;
}

export function buildBlockedSet(units: Unit[], excludeUnitId?: string): Set<string> {
  const blocked = new Set<string>();
  for (const u of units) {
    if (excludeUnitId && u.id === excludeUnitId) continue;
    blocked.add(keyXY(u.x, u.y));
  }
  return blocked;
}

/**
 * Returns all tiles reachable within `maxSteps` 4-way moves.
 * Excludes the starting tile.
 */
export function computeReachableTiles(
  start: Unit,
  maxSteps: number,
  cfg: BoardConfig,
  blocked: Set<string>
): TileCoord[] {
  const out: TileCoord[] = [];
  if (maxSteps <= 0) return out;

  const q: Array<{ x: number; y: number; d: number }> = [{ x: start.x, y: start.y, d: 0 }];
  const seen = new Set<string>([keyXY(start.x, start.y)]);

  while (q.length) {
    const cur = q.shift()!;
    if (cur.d >= maxSteps) continue;

    const nbs = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const nb of nbs) {
      const k = keyXY(nb.x, nb.y);
      if (seen.has(k)) continue;
      seen.add(k);

      if (!isInBoundsAndNotCutout(nb.x, nb.y, cfg)) continue;
      if (blocked.has(k)) continue;

      out.push({ x: nb.x, y: nb.y });
      q.push({ x: nb.x, y: nb.y, d: cur.d + 1 });
    }
  }

  return out;
}
