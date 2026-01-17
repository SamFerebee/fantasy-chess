import type { Unit } from "../units/UnitTypes";
import { isAdjacent4Way } from "../rules/adjacency";

const MELEE_RANGE = 1;
const RANGED_RANGE = 5; // Manhattan distance

export type AttackResult =
  | { ok: false; reason: "outOfRange" }
  | { ok: true; killed: true; hit: Unit };

export class CombatResolver {
  /**
   * Projectile behavior (current ranged type):
   * - ranged attacks have max range (Manhattan) = 5
   * - uses line-of-sight: first unit encountered along the line is hit (can be friendly)
   */
  tryAttack(attacker: Unit, target: Unit, units: Unit[]): AttackResult {
    // Melee: must be adjacent (4-way).
    if (attacker.attackType === "melee") {
      if (MELEE_RANGE !== 1 || !isAdjacent4Way(attacker, target)) return { ok: false, reason: "outOfRange" };
      return { ok: true, killed: true, hit: target };
    }

    // Ranged: within manhattan range
    const dist = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y);
    if (dist < 1 || dist > RANGED_RANGE) return { ok: false, reason: "outOfRange" };

    // Projectile line-of-sight: first unit on the line is hit.
    const hit = firstUnitOnLine(attacker, target, units);
    if (!hit) {
      // Shouldn't happen (target is a unit), but keep it safe.
      return { ok: true, killed: true, hit: target };
    }

    return { ok: true, killed: true, hit };
  }
}

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

/**
 * Returns the first unit encountered along the straight line from attacker -> target
 * (excluding the attacker's own tile), inclusive of the target tile.
 */
function firstUnitOnLine(attacker: Unit, target: Unit, units: Unit[]): Unit | null {
  const byPos = new Map<string, Unit>();
  for (const u of units) byPos.set(keyXY(u.x, u.y), u);

  const line = bresenham(attacker.x, attacker.y, target.x, target.y);

  // Skip index 0 (attacker tile). Scan forward and return the first unit we see.
  for (let i = 1; i < line.length; i++) {
    const p = line[i];
    const u = byPos.get(keyXY(p.x, p.y));
    if (!u) continue;
    if (u.id === attacker.id) continue;
    return u; // can be friendly or enemy; "first blocker wins"
  }

  return null;
}

/**
 * Bresenham line on grid coordinates (x,y). Returns inclusive endpoints.
 */
function bresenham(x0: number, y0: number, x1: number, y1: number): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];

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
