import type { AttackProfile, Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { isAdjacent4Way } from "../rules/adjacency";
import { bresenhamLine } from "../util/gridLine";
import { canScoutKnightBypass, getScoutDoubleKnightBlockerTile } from "./scout/ScoutShot";

export type AttackResult =
  | { ok: false; reason: "outOfRange" | "illegalTarget" }
  | {
      ok: true;
      /** Null means the attack was executed but hit no unit. */
      hit: Unit | null;
      damageDealt: number;
      targetHPAfter: number | null;
      killed: boolean;
    };

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
   * Tile-targeted attack resolution.
   * This is the most server-authoritative-friendly surface: the client sends only an aim tile
   * and the resolver deterministically determines what (if anything) is hit.
   */
  tryAttackAtTile(attacker: Unit, targetTile: TileCoord, units: Unit[]): AttackResult {
    const atk = attacker.attack;

    // Range gate (Manhattan) for all non-self attacks.
    const range = getPrimaryRangeFromAttack(atk);
    const dist = Math.abs(attacker.x - targetTile.x) + Math.abs(attacker.y - targetTile.y);

    // Melee adjacency (must target an occupied enemy tile).
    if (atk.kind === "melee_adjacent") {
      if (dist !== 1) return { ok: false, reason: "outOfRange" };
      const target = findUnitAt(units, targetTile.x, targetTile.y);
      if (!target) return { ok: false, reason: "illegalTarget" };
      if (!isAdjacent4Way(attacker, target)) return { ok: false, reason: "outOfRange" };
      return this.applyDamage(attacker, target);
    }
    if (dist < 1 || dist > range) return { ok: false, reason: "outOfRange" };

    // Projectile (blockable)
    if (atk.kind === "projectile_blockable_single") {
      // Scout special rules:
      // 1) If aiming a 2x knight and the midpoint landing tile is occupied,
      //    the shot is blocked BY THAT MIDPOINT and should hit that unit.
      // 2) Otherwise, if aiming a valid knight (x1 or x2 with midpoint empty),
      //    the shot hits the intended target ignoring blockers.
      if (attacker.name === "scout") {
        const blockerMid = getScoutDoubleKnightBlockerTile(attacker, targetTile, units);
        if (blockerMid) {
          const hit = units.find((u) => u.x === blockerMid.x && u.y === blockerMid.y) ?? null;
          if (hit) return this.applyDamage(attacker, hit);
        }

        const bypass = canScoutKnightBypass(attacker, targetTile, units);
        if (bypass) {
          const hit = findUnitAt(units, targetTile.x, targetTile.y);
          if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
          return this.applyDamage(attacker, hit);
        }
      }

      // Normal behavior: first unit on the line wins (inclusive of target tile if occupied).
      const hit = firstUnitOnLineToTile(attacker, targetTile, units);
      if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
      return this.applyDamage(attacker, hit);
    }

    // Projectile (unblockable)
    if (atk.kind === "projectile_unblockable_single") {
      const hit = findUnitAt(units, targetTile.x, targetTile.y);
      if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
      return this.applyDamage(attacker, hit);
    }

    return { ok: false, reason: "outOfRange" };
  }

  private applyDamage(attacker: Unit, target: Unit): AttackResult {
    const raw = Math.max(0, attacker.damage);
    const mitigated = Math.max(0, raw - Math.max(0, target.armor));

    const hpAfter = Math.max(0, target.hp - mitigated);
    const killed = hpAfter <= 0;

    return { ok: true, killed, hit: target, damageDealt: mitigated, targetHPAfter: hpAfter };
  }

  /** Backwards-compatible helper for older call sites (unit-targeted). */
  tryAttack(attacker: Unit, target: Unit, units: Unit[]): AttackResult {
    return this.tryAttackAtTile(attacker, { x: target.x, y: target.y }, units);
  }
}

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

function findUnitAt(units: Unit[], x: number, y: number): Unit | null {
  return units.find((u) => u.x === x && u.y === y) ?? null;
}

/**
 * Returns the first unit encountered along the straight line from attacker -> target
 * (excluding attacker tile), inclusive of the target tile.
 */
function firstUnitOnLineToTile(attacker: Unit, targetTile: TileCoord, units: Unit[]): Unit | null {
  const byPos = new Map<string, Unit>();
  for (const u of units) byPos.set(keyXY(u.x, u.y), u);

  const line = bresenhamLine(attacker.x, attacker.y, targetTile.x, targetTile.y);

  for (let i = 1; i < line.length; i++) {
    const p = line[i];
    const u = byPos.get(keyXY(p.x, p.y));
    if (!u) continue;
    if (u.id === attacker.id) continue;
    return u;
  }

  return null;
}
