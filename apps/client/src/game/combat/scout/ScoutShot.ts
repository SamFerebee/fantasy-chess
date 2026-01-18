import type { PosUnit, TileCoord } from "../lineOfSight";
import { computeProjectilePath } from "../lineOfSight";
import { tryResolveScoutMicroLaneTilePath } from "../microlanes/ScoutMicroLaneResolver";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

function isKnightDelta(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
}

function isDoubleKnightDelta(dx: number, dy: number): boolean {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  return (ax === 4 && ay === 2) || (ax === 2 && ay === 4);
}

/**
 * For double-knight attempts only:
 * returns the midpoint landing tile if it is occupied (this is the ONLY blocker for 2x knight).
 */
export function getScoutDoubleKnightBlockerTile(attacker: PosUnit, aimTile: TileCoord, units: PosUnit[]): TileCoord | null {
  const dx = aimTile.x - attacker.x;
  const dy = aimTile.y - attacker.y;
  if (!isDoubleKnightDelta(dx, dy)) return null;

  const midX = attacker.x + dx / 2;
  const midY = attacker.y + dy / 2;

  const byPos = new Map<string, PosUnit>();
  for (const u of units) byPos.set(keyXY(u.x, u.y), u);

  return byPos.has(keyXY(midX, midY)) ? { x: midX, y: midY } : null;
}

/**
 * Knight bypass rules (STRICT, deterministic):
 * - Knight x1: delta is (±2,±1) or (±1,±2) => allowed, ignores blockers.
 * - Knight x2: delta is (±4,±2) or (±2,±4) => allowed ONLY if midpoint landing tile is empty.
 */
export function canScoutKnightBypass(attacker: PosUnit, aimTile: TileCoord, units: PosUnit[]): boolean {
  const dx = aimTile.x - attacker.x;
  const dy = aimTile.y - attacker.y;

  if (isKnightDelta(dx, dy)) return true;

  if (isDoubleKnightDelta(dx, dy)) {
    const midX = attacker.x + dx / 2;
    const midY = attacker.y + dy / 2;

    const byPos = new Map<string, PosUnit>();
    for (const u of units) byPos.set(keyXY(u.x, u.y), u);

    // Only midpoint landing blocks double-knight
    return !byPos.has(keyXY(midX, midY));
  }

  return false;
}

/**
 * Scout preview path:
 * - If unblocked: show normal straight-line path.
 * - If blocked: apply knight rules, then micro-lane seam path, else show blocked LOS path.
 *
 * IMPORTANT: This function intentionally calls the SAME micro-lane helper used by CombatResolver
 * so preview + resolution stay identical.
 */
export function computeScoutProjectilePath(
  attacker: PosUnit,
  aimTile: TileCoord,
  units: PosUnit[],
  maxRange: number
): TileCoord[] {
  const losPath = computeProjectilePath(attacker, aimTile, units);
  if (!losPath || losPath.length < 2) return losPath ?? [];

  const last = losPath[losPath.length - 1];
  const blockedBeforeAim = last.x !== aimTile.x || last.y !== aimTile.y;

  if (!blockedBeforeAim) return losPath;

  // 1) double-knight midpoint block preview (hit midpoint if occupied)
  const blockerMid = getScoutDoubleKnightBlockerTile(attacker, aimTile, units);
  if (blockerMid) {
    return [
      { x: attacker.x, y: attacker.y },
      { x: blockerMid.x, y: blockerMid.y },
    ];
  }

  // 2) knight bypass preview (ignore blockers)
  if (canScoutKnightBypass(attacker, aimTile, units)) {
    return [
      { x: attacker.x, y: attacker.y },
      { x: aimTile.x, y: aimTile.y },
    ];
  }

  // 3) micro-lane seam threading preview
  // We call the exact same helper as CombatResolver. It expects Unit[], but only uses id/x/y.
  // Provide minimal compatible objects to avoid importing Unit types here.
  const attackerUnitLike = { id: attacker.id, x: attacker.x, y: attacker.y } as any;
  const unitsLike = units.map((u) => ({ id: u.id, x: u.x, y: u.y })) as any;

  const micro = tryResolveScoutMicroLaneTilePath(attackerUnitLike, aimTile, unitsLike, Math.max(0, maxRange));
  if (micro) return micro;

  return losPath;
}
