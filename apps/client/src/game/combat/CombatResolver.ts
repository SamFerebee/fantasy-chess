import type { AttackProfile, Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { isAdjacent4Way } from "../rules/adjacency";
import { bresenhamLine } from "../util/gridLine";
import { canScoutKnightBypass, getScoutDoubleKnightBlockerTile } from "./scout/ScoutShot";
import { tryResolveScoutMicroLaneTilePath } from "./microlanes/ScoutMicroLaneResolver";

export type AttackResult =
  | { ok: false; reason: "outOfRange" | "illegalTarget" }
  | {
      ok: true;
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
  tryAttackAtTile(attacker: Unit, targetTile: TileCoord, units: Unit[]): AttackResult {
    const atk = attacker.attack;

    const range = getPrimaryRangeFromAttack(atk);
    const dist = Math.abs(attacker.x - targetTile.x) + Math.abs(attacker.y - targetTile.y);

    if (atk.kind === "melee_adjacent") {
      if (dist !== 1) return { ok: false, reason: "outOfRange" };
      const target = findUnitAt(units, targetTile.x, targetTile.y);
      if (!target) return { ok: false, reason: "illegalTarget" };
      if (!isAdjacent4Way(attacker, target)) return { ok: false, reason: "outOfRange" };
      return this.applyDamage(attacker, target);
    }

    if (dist < 1 || dist > range) return { ok: false, reason: "outOfRange" };

    if (atk.kind === "projectile_blockable_single") {
      const firstHit = firstUnitOnLineToTile(attacker, targetTile, units);
      if (!firstHit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };

      const hitIsAimTile = firstHit.x === targetTile.x && firstHit.y === targetTile.y;
      if (hitIsAimTile) return this.applyDamage(attacker, firstHit);

      // Blocked before aim.
      if (attacker.name === "scout") {
        // 1) double-knight midpoint block rule (if midpoint occupied, hit it)
        const mid = getScoutDoubleKnightBlockerTile(attacker, targetTile, units);
        if (mid) {
          const midUnit = findUnitAt(units, mid.x, mid.y);
          if (midUnit) return this.applyDamage(attacker, midUnit);
        }

        // 2) knight bypass endpoints
        if (canScoutKnightBypass(attacker, targetTile, units)) {
          const hit = findUnitAt(units, targetTile.x, targetTile.y);
          if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
          return this.applyDamage(attacker, hit);
        }

        // 3) micro-lane seam threading (between tiles)
        // This DOES NOT "go around" broadly because the micro BFS is tightly bounded.
        const micro = tryResolveScoutMicroLaneTilePath(attacker, targetTile, units, range);
        if (micro) {
          const hit = findUnitAt(units, targetTile.x, targetTile.y);
          if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
          return this.applyDamage(attacker, hit);
        }
      }

      // Default: blocked; hit the first blocker.
      return this.applyDamage(attacker, firstHit);
    }

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
