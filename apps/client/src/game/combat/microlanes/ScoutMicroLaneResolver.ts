import type { TileCoord } from "../../movement/path";
import type { Unit } from "../../units/UnitTypes";
import { findScoutMicroLanePath, microPathToTilePath } from "./ScoutMicroLanePath";

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

/**
 * Scout-only micro-lane resolver:
 * Returns a TileCoord[] highlight path (tile centers visited) if a seam path exists.
 */
export function tryResolveScoutMicroLaneTilePath(attacker: Unit, aimTile: TileCoord, units: Unit[], maxRange: number): TileCoord[] | null {
  const occupied = new Set<string>();
  for (const u of units) {
    if (u.id === attacker.id) continue;
    occupied.add(tileKey(u.x, u.y));
  }

  const nodes = findScoutMicroLanePath({
    attacker: { x: attacker.x, y: attacker.y },
    aim: aimTile,
    occupiedTiles: occupied,
    maxRange,
  });

  if (!nodes) return null;

  // Coarse tile path for existing tile overlay
  const tiles = microPathToTilePath(nodes);

  // Ensure it ends at aim tile for UI clarity.
  const last = tiles[tiles.length - 1];
  if (!last || last.x !== aimTile.x || last.y !== aimTile.y) {
    tiles.push({ x: aimTile.x, y: aimTile.y });
  }

  return tiles;
}
