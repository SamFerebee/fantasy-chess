import type { PosUnit, TileCoord } from "../lineOfSight";
import { computeProjectilePath } from "../lineOfSight";

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
 * - Knight shots: show ONLY the landing tile (as a direct shot).
 * - Double-knight blocked: show ONLY the midpoint blocker tile (direct shot to blocker).
 * - Otherwise: show normal straight-line (blocked) path.
 */
export function computeScoutProjectilePath(attacker: PosUnit, aimTile: TileCoord, units: PosUnit[]): TileCoord[] {
  const blockerMid = getScoutDoubleKnightBlockerTile(attacker, aimTile, units);
  if (blockerMid) {
    return [
      { x: attacker.x, y: attacker.y },
      { x: blockerMid.x, y: blockerMid.y },
    ];
  }

  if (canScoutKnightBypass(attacker, aimTile, units)) {
    return [
      { x: attacker.x, y: attacker.y },
      { x: aimTile.x, y: aimTile.y },
    ];
  }

  return computeProjectilePath(attacker, aimTile, units);
}
