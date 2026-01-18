import type { TileCoord } from "../movement/path";
import type { Unit } from "../units/UnitTypes";
import { tryGetPatternDef } from "./patterns/PatternLibrary";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export type PatternShotResolveArgs = {
  attacker: Pick<Unit, "id" | "x" | "y">;
  /** The aimed tile (usually the clicked/hovered target unit's tile). */
  aimTile: TileCoord;
  units: Unit[];

  patternId: string;
  /**
   * If true: the first unit encountered on the footprint stops the path and is hit.
   * If false: blockers do not stop the path; the unit on aimTile is hit.
   */
  blockedByUnits: boolean;

  /** Optional piercing (MVP: only 0/undefined is used). */
  pierceCount?: number;
};

export type PatternShotResolution = {
  /** Ordered path tiles including attacker tile at index 0. */
  path: TileCoord[];
  /** Ordered hit unit ids (MVP: 0 or 1). */
  hitUnitIds: string[];
};

/**
 * Resolves a deterministic pattern shot.
 *
 * Determinism rules:
 * - integer tile math only
 * - footprint order is defined by the pattern
 */
export function resolvePatternShot(args: PatternShotResolveArgs): PatternShotResolution | null {
  const def = tryGetPatternDef(args.patternId);
  if (!def) return null;

  const dx = args.aimTile.x - args.attacker.x;
  const dy = args.aimTile.y - args.attacker.y;
  const endpoint = { x: dx, y: dy };

  // Aim must match a legal endpoint.
  const isEndpoint = def.endpoints.some((e) => e.x === endpoint.x && e.y === endpoint.y);
  if (!isEndpoint) return null;

  const footprint = def.buildFootprintForEndpoint(endpoint);
  if (!footprint || footprint.length === 0) return null;

  // Ensure footprint ends at the endpoint.
  const last = footprint[footprint.length - 1];
  if (last.x !== endpoint.x || last.y !== endpoint.y) return null;

  const byPos = new Map<string, Unit>();
  for (const u of args.units) byPos.set(keyXY(u.x, u.y), u);

  // Build absolute path. Include attacker at index 0.
  const path: TileCoord[] = [{ x: args.attacker.x, y: args.attacker.y }];
  for (const off of footprint) {
    path.push({ x: args.attacker.x + off.x, y: args.attacker.y + off.y });
  }

  // MVP hit resolution: first hit only (optionally blockedByUnits).
  if (args.blockedByUnits) {
    for (let i = 1; i < path.length; i++) {
      const p = path[i];
      const u = byPos.get(keyXY(p.x, p.y));
      if (!u) continue;
      if (u.id === args.attacker.id) continue;

      // Stop on the first encountered unit.
      return { path: path.slice(0, i + 1), hitUnitIds: [u.id] };
    }

    // No unit on the footprint tiles.
    return { path, hitUnitIds: [] };
  }

  // Unblockable: hit only the unit on aimTile (if any).
  const aimUnit = byPos.get(keyXY(args.aimTile.x, args.aimTile.y));
  return { path, hitUnitIds: aimUnit ? [aimUnit.id] : [] };
}
