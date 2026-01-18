import type { TileCoord } from "../../movement/path";
import type { Unit } from "../../units/UnitTypes";
import type { PosUnit } from "../lineOfSight";
import { SCOUT_LANES } from "./ScoutLaneLibrary.ts";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export function tryResolveScoutLanePath(
  attacker: { x: number; y: number },
  aimTile: TileCoord,
  units: Array<Pick<Unit, "id" | "x" | "y">> | PosUnit[]
): TileCoord[] | null {
  const dx = aimTile.x - attacker.x;
  const dy = aimTile.y - attacker.y;

  const candidates = SCOUT_LANES.get(dx, dy);
  if (candidates.length === 0) return null;

  // Occupancy blockers: any occupied tile blocks; aim tile is allowed.
  const occ = new Map<string, true>();
  for (const u of units) {
    if (u.x === attacker.x && u.y === attacker.y) continue; // attacker tile never blocks
    occ.set(keyXY(u.x, u.y), true);
  }

  for (const rel of candidates) {
    const abs: TileCoord[] = rel.map((p) => ({ x: p.x + attacker.x, y: p.y + attacker.y }));

    // Allow the aim tile to be occupied (that’s the target).
    const occ2 = new Map(occ);
    occ2.delete(keyXY(aimTile.x, aimTile.y));

    let blocked = false;
    for (let i = 1; i < abs.length - 1; i++) {
      const p = abs[i];
      if (occ2.has(keyXY(p.x, p.y))) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;

    const last = abs[abs.length - 1];
    if (last.x !== aimTile.x || last.y !== aimTile.y) continue;

    return abs;
  }

  return null;
}
