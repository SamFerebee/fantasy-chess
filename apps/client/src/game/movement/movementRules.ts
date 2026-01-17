import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { Tile } from "./MovementController";

export function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export function isInBoundsAndNotCutout(x: number, y: number, cfg: BoardConfig): boolean {
  if (x < 0 || y < 0 || x >= cfg.cols || y >= cfg.rows) return false;

  const c = cfg.cornerCut;
  if (c > 0) {
    const inTL = x < c && y < c;
    const inTR = x >= cfg.cols - c && y < c;
    const inBL = x < c && y >= cfg.rows - c;
    const inBR = x >= cfg.cols - c && y >= cfg.rows - c;
    if (inTL || inTR || inBL || inBR) return false;
  }

  return true;
}

export function buildBlockedSet(units: Unit[], ignoreUnitId: string): Set<string> {
  const blocked = new Set<string>();
  for (const u of units) {
    if (u.id === ignoreUnitId) continue;
    blocked.add(keyXY(u.x, u.y));
  }
  return blocked;
}

export function computeReachableTiles(
  start: Unit,
  maxSteps: number,
  cfg: BoardConfig,
  blocked: Set<string>
): Tile[] {
  if (maxSteps <= 0) return [];

  const startKey = keyXY(start.x, start.y);

  const q: Array<{ x: number; y: number; d: number }> = [{ x: start.x, y: start.y, d: 0 }];
  const seen = new Set<string>([startKey]);

  const out: Tile[] = [];

  while (q.length) {
    const cur = q.shift()!;
    if (cur.d > 0) out.push({ x: cur.x, y: cur.y });
    if (cur.d === maxSteps) continue;

    const nbs = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const nb of nbs) {
      if (!isInBoundsAndNotCutout(nb.x, nb.y, cfg)) continue;

      const k = keyXY(nb.x, nb.y);
      if (seen.has(k)) continue;
      if (blocked.has(k)) continue;

      seen.add(k);
      q.push({ x: nb.x, y: nb.y, d: cur.d + 1 });
    }
  }

  return out;
}
