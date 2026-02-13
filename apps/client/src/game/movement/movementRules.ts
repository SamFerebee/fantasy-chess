import type { BoardRulesConfig } from "../board/BoardRules";
import { isInBoundsAndNotCutout } from "../board/BoardRules";
import type { TileCoord } from "./path";

export { isInBoundsAndNotCutout };

export function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

// NOTE: isInBoundsAndNotCutout is now defined in board/BoardRules.ts so that
// sim/movement can share it without importing render BoardConfig.

export { isInBoundsAndNotCutout };

export type PosId = { id: string; x: number; y: number };
export type PosOnly = { x: number; y: number };

export function buildBlockedSet(units: ReadonlyArray<PosId>, excludeUnitId?: string): Set<string> {
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
  start: PosOnly,
  maxSteps: number,
  cfg: BoardRulesConfig,
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
