import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { isInBoundsAndNotCutout } from "../movement/movementRules";

export function getAttackRangeForUnit(unit: Unit): number {
  return Math.max(0, unit.attackRange);
}

/**
 * Returns all tiles in attack range (excluding the unit's own tile).
 * Uses 4-way Manhattan distance.
 */
export function computeAttackTiles(unit: Unit, cfg: BoardConfig): TileCoord[] {
  const r = getAttackRangeForUnit(unit);
  const out: TileCoord[] = [];

  if (r <= 0) return out;

  // melee special-case: just 4 neighbors
  if (unit.attackType === "melee") {
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

  // ranged: all tiles within manhattan distance <= r, excluding dist 0
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
