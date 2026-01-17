import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { Tile } from "./MovementController";
import { isInBoundsAndNotCutout, keyXY } from "./movementRules";

export function getPathForMove(
  start: Unit,
  dest: Tile,
  maxSteps: number,
  cfg: BoardConfig,
  blocked: Set<string>
): Tile[] {
  if (maxSteps <= 0) return [];
  if (start.x === dest.x && start.y === dest.y) return [];

  const destKey = keyXY(dest.x, dest.y);

  const q: Array<{ x: number; y: number }> = [{ x: start.x, y: start.y }];
  const prev = new Map<string, string | null>();
  const dist = new Map<string, number>();

  const startKey = keyXY(start.x, start.y);
  prev.set(startKey, null);
  dist.set(startKey, 0);

  while (q.length) {
    const cur = q.shift()!;
    const curKey = keyXY(cur.x, cur.y);
    const curD = dist.get(curKey) ?? 0;

    if (curKey === destKey) break;
    if (curD === maxSteps) continue;

    const nbs = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const nb of nbs) {
      if (!isInBoundsAndNotCutout(nb.x, nb.y, cfg)) continue;
      const k = keyXY(nb.x, nb.y);
      if (prev.has(k)) continue;
      if (blocked.has(k)) continue;

      prev.set(k, curKey);
      dist.set(k, curD + 1);
      q.push(nb);
    }
  }

  if (!prev.has(destKey)) return [];

  // reconstruct (includes start and dest)
  const pathRev: Tile[] = [];
  let cur: string | null = destKey;
  while (cur) {
    const [xs, ys] = cur.split(",");
    pathRev.push({ x: Number(xs), y: Number(ys) });
    cur = prev.get(cur) ?? null;
  }
  pathRev.reverse();

  // enforce maxSteps
  if (pathRev.length - 1 > maxSteps) return [];
  return pathRev;
}
