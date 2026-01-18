import type { AttackProfile, Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { isAdjacent4Way } from "../rules/adjacency";
import { bresenhamLine } from "../util/gridLine";
import { resolvePatternShot } from "./PatternShotResolver";

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
      // 1) Resolve as normal straight-line blockable projectile.
      const line = bresenhamLine(attacker.x, attacker.y, targetTile.x, targetTile.y);

      // Find first unit encountered along the line (excluding attacker tile).
      let firstHit: Unit | null = null;
      let firstHitIndex = -1;

      const byPos = new Map<string, Unit>();
      for (const u of units) byPos.set(keyXY(u.x, u.y), u);

      for (let i = 1; i < line.length; i++) {
        const p = line[i];
        const u = byPos.get(keyXY(p.x, p.y));
        if (!u) continue;
        if (u.id === attacker.id) continue;
        firstHit = u;
        firstHitIndex = i;
        break;
      }

      if (!firstHit) {
        return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };
      }

      const hitIsAimTile = firstHit.x === targetTile.x && firstHit.y === targetTile.y;

      // 2) If NOT blocked before the aim tile, use the normal hit.
      if (hitIsAimTile) {
        return this.applyDamage(attacker, firstHit);
      }

      // 3) Blocked before aim tile:
      //    If the attack has fallback patterns and the aim delta matches an allowed endpoint,
      //    resolve via the first matching pattern instead.
      const fallbackIds = atk.patternFallbackIds ?? [];
      if (fallbackIds.length > 0) {
        for (const patternId of fallbackIds) {
          const pat = resolvePatternShot({
            attacker,
            aimTile: targetTile,
            units,
            patternId,
            blockedByUnits: true, // knightShot uses midpoint blocking via footprint
            pierceCount: undefined,
          });

          if (!pat) continue;

          const hitId = pat.hitUnitIds[0] ?? null;
          const hit = hitId ? units.find((u) => u.id === hitId) ?? null : null;

          // Pattern resolution can legitimately miss (e.g. endpoint empty, midpoint empty).
          if (!hit) return { ok: true, hit: null, damageDealt: 0, targetHPAfter: null, killed: false };

          return this.applyDamage(attacker, hit);
        }
      }

      // 4) No pattern match → keep the original blocked result (hit the blocker).
      return this.applyDamage(attacker, firstHit);
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
