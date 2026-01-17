import type { AttackProfile, Unit } from "../units/UnitTypes";
import { isAdjacent4Way } from "../rules/adjacency";

export type AttackResult =
  | { ok: false; reason: "outOfRange" }
  | { ok: true; killed: boolean; hit: Unit; damageDealt: number; targetHPAfter: number };

function getPrimaryRangeFromAttack(attack: AttackProfile): number {
  switch (attack.kind) {
    case "melee_adjacent":
      return 1;

    case "projectile_blockable_single":
    case "projectile_unblockable_single":
    case "line_hit_all":
      return Math.max(0, attack.range);

    case "pattern_shot":
      return Math.max(0, attack.maxRange);

    case "quake_aoe":
      return 0;
  }
}

export class CombatResolver {
  /**
   * Current implemented behaviors:
   * - melee_adjacent: must be adjacent (4-way)
   * - projectile_blockable_single: must be within range gate (Manhattan); first unit on line is hit (can be friendly)
   * - projectile_unblockable_single: must be within range gate (Manhattan); target is hit directly (ignores blockers)
   *
   * NOTE: other `AttackProfile.kind` values exist for future-proofing but are not resolved by this method yet.
   */
  tryAttack(attacker: Unit, target: Unit, units: Unit[]): AttackResult {
    const atk = attacker.attack;

    // Melee adjacency
    if (atk.kind === "melee_adjacent") {
      if (!isAdjacent4Way(attacker, target)) return { ok: false, reason: "outOfRange" };
      return this.applyDamage(attacker, target);
    }

    // Range gate (Manhattan) for the currently supported targeted attacks
    const range = getPrimaryRangeFromAttack(atk);
    const dist = Math.abs(attacker.x - target.x) + Math.abs(attacker.y - target.y);
    if (dist < 1 || dist > range) return { ok: false, reason: "outOfRange" };

    // Projectile (blockable): first unit on the line wins
    if (atk.kind === "projectile_blockable_single") {
      const hit = firstUnitOnLine(attacker, target, units) ?? target;
      return this.applyDamage(attacker, hit);
    }

    // Projectile (unblockable): ignore blockers and hit the intended target
    if (atk.kind === "projectile_unblockable_single") {
      return this.applyDamage(attacker, target);
    }

    // Not implemented in this resolver API yet (needs tile targeting / multi-hit return types).
    return { ok: false, reason: "outOfRange" };
  }

  private applyDamage(attacker: Unit, target: Unit): AttackResult {
    const raw = Math.max(0, attacker.damage);
    const mitigated = Math.max(0, raw - Math.max(0, target.armor));

    const hpAfter = Math.max(0, target.hp - mitigated);
    const killed = hpAfter <= 0;

    // Note: This resolver returns the computed outcome. Actual mutation/state updates
    // should be performed by the game state system that calls CombatResolver.
    return { ok: true, killed, hit: target, damageDealt: mitigated, targetHPAfter: hpAfter };
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
