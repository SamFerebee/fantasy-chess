import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "./path";
import { isInBoundsAndNotCutout, keyXY } from "./movementRules";

export function getPathForMove(
  start: Unit,
  dest: TileCoord,
  maxSteps: number,
  cfg: BoardConfig,
  blocked: Set<string>
): TileCoord[] {
  if (maxSteps <= 0) return [];
  if (start.x === dest.x && start.y === dest.y) return [];
  if (!isInBoundsAndNotCutout(dest.x, dest.y, cfg)) return [];
  if (blocked.has(keyXY(dest.x, dest.y))) return [];

  // BFS for shortest path
  const q: TileCoord[] = [{ x: start.x, y: start.y }];
  const prev = new Map<string, string | null>();
  const dist = new Map<string, number>();

  const startK = keyXY(start.x, start.y);
  prev.set(startK, null);
  dist.set(startK, 0);

  while (q.length) {
    const cur = q.shift()!;
    const curK = keyXY(cur.x, cur.y);
    const curD = dist.get(curK)!;

    if (curD >= maxSteps) continue;

    const nbs = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];

    for (const nb of nbs) {
      const nbK = keyXY(nb.x, nb.y);
      if (prev.has(nbK)) continue;

      if (!isInBoundsAndNotCutout(nb.x, nb.y, cfg)) continue;
      if (blocked.has(nbK)) continue;

      prev.set(nbK, curK);
      dist.set(nbK, curD + 1);

      if (nb.x === dest.x && nb.y === dest.y) {
        // reconstruct
        const path: TileCoord[] = [];
        let k: string | null = nbK;
        while (k) {
          const [sx, sy] = k.split(",").map((v) => parseInt(v, 10));
          path.push({ x: sx, y: sy });
          k = prev.get(k) ?? null;
        }
        path.reverse();
        return path;
      }

      q.push(nb);
    }
  }

  return [];
}
