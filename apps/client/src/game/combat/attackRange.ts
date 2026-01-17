import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { isInBoundsAndNotCutout } from "../movement/movementRules";

function getPrimaryRange(unit: Unit): number {
  // Prefer attack profile; fall back to legacy field.
  const atk = unit.attack;

  switch (atk.kind) {
    case "melee_adjacent":
      return 1;

    case "projectile_blockable_single":
    case "projectile_unblockable_single":
    case "line_hit_all":
      return Math.max(0, atk.range);

    case "pattern_shot":
      return Math.max(0, atk.maxRange);

    case "quake_aoe":
      // Not a target range; keep legacy behavior of returning 0.
      return 0;
  }
}

export function getAttackRangeForUnit(unit: Unit): number {
  return Math.max(0, getPrimaryRange(unit));
}

/**
 * Returns all tiles in attack range (excluding the unit's own tile).
 *
 * Current overlay behavior:
 * - melee_adjacent: 4 neighbors
 * - quake_aoe: tiles within radius around the unit (Manhattan)
 * - everything else: tiles within Manhattan distance <= range
 */
export function computeAttackTiles(unit: Unit, cfg: BoardConfig): TileCoord[] {
  const out: TileCoord[] = [];

  // Melee adjacency
  if (unit.attack.kind === "melee_adjacent") {
    const cand = [
      { x: unit.x + 1, y: unit.y },
      { x: unit.x - 1, y: unit.y },
      { x: unit.x, y: unit.y + 1 },
      { x: unit.x, y: unit.y - 1 },
    ];
    for (const t of cand) {
      if (isInBoundsAndNotCutout(t.x, t.y, cfg)) out.push(t);
    }
    return out;
  }

  // Quake-style AOE around the unit
  if (unit.attack.kind === "quake_aoe") {
    const r = Math.max(0, unit.attack.radius);
    if (r <= 0) return out;

    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const dist = Math.abs(dx) + Math.abs(dy);
        if (dist === 0 || dist > r) continue;

        const x = unit.x + dx;
        const y = unit.y + dy;
        if (!isInBoundsAndNotCutout(x, y, cfg)) continue;

        out.push({ x, y });
      }
    }

    return out;
  }

  // Ranged / pattern / line: Manhattan diamond within primary range
  const r = getAttackRangeForUnit(unit);
  if (r <= 0) return out;

  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist === 0 || dist > r) continue;

      const x = unit.x + dx;
      const y = unit.y + dy;
      if (!isInBoundsAndNotCutout(x, y, cfg)) continue;

      out.push({ x, y });
    }
  }

  return out;
}
