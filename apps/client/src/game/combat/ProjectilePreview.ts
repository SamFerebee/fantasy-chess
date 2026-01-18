import type { TileCoord } from "../movement/path";
import type { Unit } from "../units/UnitTypes";
import type { PosUnit } from "./lineOfSight";
import { computeProjectilePath } from "./lineOfSight";
import { computeScoutProjectilePath } from "./scout/ScoutShot";

/**
 * Computes the projectile preview path shown in the UI.
 * Must match CombatResolver behavior for determinism and player trust.
 */
export function computeProjectilePreviewPath(args: {
  attacker: Unit;
  aimTile: TileCoord;
  units: Unit[];
}): TileCoord[] {
  const { attacker, aimTile, units } = args;

  const unitsPos: PosUnit[] = units.map((u) => ({ id: u.id, x: u.x, y: u.y }));
  const attackerPos: PosUnit = { id: attacker.id, x: attacker.x, y: attacker.y };

  // Default: straight-line path (truncated at first blocker).
  const losPath = computeProjectilePath(attackerPos, aimTile, unitsPos);
  if (!losPath || losPath.length === 0) return [];

  const last = losPath[losPath.length - 1];
  const blockedBeforeAim = last.x !== aimTile.x || last.y !== aimTile.y;

  // Scout-only: if blocked early, use the same scout resolver logic as CombatResolver.
  // This keeps preview deterministic and aligned with what will actually happen.
  if (blockedBeforeAim && attacker.name === "scout" && attacker.attack.kind === "projectile_blockable_single") {
    return computeScoutProjectilePath(attackerPos, aimTile, unitsPos, attacker.attack.range);
  }

  return losPath;
}
