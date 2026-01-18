import type { TileCoord } from "../../movement/path";
import type { Unit } from "../../units/UnitTypes";
import { traceGridDda, type PreferAxis } from "./GridDda";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

function signNonZero(n: number): 1 | -1 {
  return n >= 0 ? 1 : -1;
}

function dominantAxis(dx: number, dy: number): PreferAxis {
  return Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
}

type Corner = { offX: number; offY: number };

/**
 * Returns 4 corner offsets inside a tile, ordered deterministically based on travel direction.
 * The first corner is "toward" the target direction (sx, sy).
 */
function buildCornerOrder(sx: 1 | -1, sy: 1 | -1, eps: number): Corner[] {
  return [
    { offX: sx * eps, offY: sy * eps },
    { offX: sx * eps, offY: -sy * eps },
    { offX: -sx * eps, offY: sy * eps },
    { offX: -sx * eps, offY: -sy * eps },
  ];
}

/**
 * Scout-only auto-lane selection.
 *
 * We try a fixed set of 16 "lanes" by combining:
 * - 4 start corners inside the attacker tile
 * - 4 end corners inside the aim tile
 *
 * This is the missing piece for your examples: when the blocker is very near the shooter,
 * changing only the end point usually cannot change which adjacent cell is entered first.
 */
export function tryFindUnblockedScoutLanePath(attacker: Unit, aimTile: TileCoord, units: Unit[]): TileCoord[] | null {
  const dx = aimTile.x - attacker.x;
  const dy = aimTile.y - attacker.y;

  const sx = signNonZero(dx);
  const sy = signNonZero(dy);

  // Hug edges aggressively (still inside the tile) to maximize "threading" ability.
  // 0.49 keeps us inside [0,1) but very close to boundaries.
  const epsStart = 0.49;
  const epsEnd = 0.49;

  const preferAxis = dominantAxis(dx, dy);

  const startCorners = buildCornerOrder(sx, sy, epsStart);
  const endCorners = buildCornerOrder(sx, sy, epsEnd);

  const occ = new Map<string, Unit>();
  for (const u of units) occ.set(keyXY(u.x, u.y), u);

  // Deterministic nested ordering: start corner priority first, then end corner priority.
  for (const s of startCorners) {
    const start = { x: attacker.x + 0.5 + s.offX, y: attacker.y + 0.5 + s.offY };

    for (const e of endCorners) {
      const end = { x: aimTile.x + 0.5 + e.offX, y: aimTile.y + 0.5 + e.offY };

      const path = traceGridDda(start, end, preferAxis, 512);
      if (path.length < 2) continue;

      const last = path[path.length - 1];
      if (last.x !== aimTile.x || last.y !== aimTile.y) {
        // If the endpoint lands in a neighboring cell due to floating effects, reject.
        continue;
      }

      // Check blockers on all tiles BEFORE the aim tile.
      let blocked = false;
      for (let i = 1; i < path.length - 1; i++) {
        const p = path[i];
        const u = occ.get(keyXY(p.x, p.y));
        if (!u) continue;
        if (u.id === attacker.id) continue;
        blocked = true;
        break;
      }

      if (!blocked) return path;
    }
  }

  return null;
}
