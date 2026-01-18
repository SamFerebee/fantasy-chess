import type { Unit } from "../units/UnitTypes";
import { bresenhamLine } from "../util/gridLine";

export type TileCoord = { x: number; y: number };

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

/**
 * Default projectile path: straight Bresenham line, but stops at the first unit encountered.
 * (Includes attacker tile at index 0.)
 */
export function computeProjectilePath(attacker: Unit, aimTile: TileCoord, units: Unit[]): TileCoord[] {
  const byPos = new Map<string, Unit>();
  for (const u of units) byPos.set(keyXY(u.x, u.y), u);

  const line = bresenhamLine(attacker.x, attacker.y, aimTile.x, aimTile.y);

  // Truncate at first blocking unit (excluding attacker tile).
  for (let i = 1; i < line.length; i++) {
    const p = line[i];
    const u = byPos.get(keyXY(p.x, p.y));
    if (!u) continue;
    if (u.id === attacker.id) continue;
    return line.slice(0, i + 1);
  }

  return line;
}
