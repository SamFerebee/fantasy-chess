import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "./path";
import { shortestPath4, tileKey } from "./path";
import { buildBlockedSet, isInBoundsAndNotCutout, keyXY } from "./movementRules";

/**
 * Returns the shortest path from selected -> dest within movement constraints,
 * or null if unreachable.
 */
export function getPathForMove(args: {
  cfg: BoardConfig;
  units: Unit[];
  selected: Unit;
  dest: TileCoord;
  reachableKeys: Set<string>;
}): TileCoord[] | null {
  const goalKey = tileKey(args.dest);
  if (!args.reachableKeys.has(goalKey)) return null;

  const blocked = buildBlockedSet(args.units, args.selected.id);

  return shortestPath4(
    { x: args.selected.x, y: args.selected.y },
    { x: args.dest.x, y: args.dest.y },
    {
      inBounds: (t) => isInBoundsAndNotCutout(args.cfg, t),
      isBlocked: (t) => blocked.has(keyXY(t.x, t.y)),
      maxSteps: args.selected.moveRange,
      reachableKeys: args.reachableKeys,
    }
  );
}
