import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

/**
 * Projectile path from attacker -> target tile using Bresenham.
 * Stops at the first unit encountered (can be friendly) and includes that tile.
 * Returns an array including the attacker tile at index 0.
 */
export function computeProjectilePath(
  attacker: Pick<Unit, "id" | "x" | "y">,
  target: TileCoord,
  units: Unit[]
): TileCoord[] {
  const byPos = new Map<string, Unit>();
  for (const u of units) byPos.set(keyXY(u.x, u.y), u);

  const line = bresenham(attacker.x, attacker.y, target.x, target.y);

  // Stop at first blocker (excluding attacker), inclusive.
  const out: TileCoord[] = [];
  for (let i = 0; i < line.length; i++) {
    const p = line[i];
    out.push(p);

    if (i === 0) continue;

    const u = byPos.get(keyXY(p.x, p.y));
    if (u && u.id !== attacker.id) break;
  }

  return out;
}

/** Bresenham line on grid coords. Inclusive endpoints. */
function bresenham(x0: number, y0: number, x1: number, y1: number): TileCoord[] {
  const out: TileCoord[] = [];

  let x = x0;
  let y = y0;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    out.push({ x, y });
    if (x === x1 && y === y1) break;

    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return out;
}
