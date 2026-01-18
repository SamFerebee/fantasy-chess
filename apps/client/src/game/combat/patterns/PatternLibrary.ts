import type { TileCoord } from "../../movement/path";

/**
 * Deterministic shot patterns for TAO-style Scout attacks.
 *
 * Patterns are expressed in integer tile offsets from the attacker.
 * The resolver uses these definitions to build an ordered footprint (path) and resolve hits.
 */

export type PatternId = "knightShot";

export type PatternDef = {
  id: PatternId;

  /**
   * Primary max-range gate used for UI and coarse validation (Manhattan).
   * Pattern-specific resolver still validates that the aim tile matches a legal endpoint.
   */
  maxRange: number;

  /**
   * Legal endpoints (relative to attacker tile) that can be "aimed".
   * Example: knight shot endpoints are L-shaped offsets.
   */
  endpoints: ReadonlyArray<TileCoord>;

  /**
   * Builds an ordered footprint (relative tile offsets) for the given endpoint.
   * Must return a deterministic sequence with the endpoint as the final offset.
   *
   * The returned offsets should NOT include {0,0} (attacker origin).
   */
  buildFootprintForEndpoint: (endpoint: TileCoord) => ReadonlyArray<TileCoord>;
};

function eq(a: TileCoord, b: TileCoord): boolean {
  return a.x === b.x && a.y === b.y;
}

function isKnightEndpoint(endpoint: TileCoord): boolean {
  const ax = Math.abs(endpoint.x);
  const ay = Math.abs(endpoint.y);
  return (ax === 2 && ay === 1) || (ax === 1 && ay === 2);
}

function isDoubleKnightEndpoint(endpoint: TileCoord): boolean {
  const ax = Math.abs(endpoint.x);
  const ay = Math.abs(endpoint.y);
  return (ax === 4 && ay === 2) || (ax === 2 && ay === 4);
}

/**
 * "Knight shot" (current Scout MVP):
 * - Knight x1: delta is (±2,±1) or (±1,±2) => allowed, ignores blockers.
 * - Knight x2: delta is (±4,±2) or (±2,±4) => allowed ONLY if midpoint landing tile is empty.
 *
 * Footprint convention:
 * - Knight x1: direct landing only (endpoint).
 * - Knight x2: midpoint landing, then endpoint.
 */
export const KNIGHT_SHOT: PatternDef = {
  id: "knightShot",
  // Manhattan max-range gate. x1 knight => 3, x2 knight => 6.
  maxRange: 6,
  endpoints: Object.freeze([
    // Knight x1
    { x: 2, y: 1 },
    { x: 2, y: -1 },
    { x: -2, y: 1 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
    { x: 1, y: -2 },
    { x: -1, y: 2 },
    { x: -1, y: -2 },

    // Knight x2 (double knight)
    { x: 4, y: 2 },
    { x: 4, y: -2 },
    { x: -4, y: 2 },
    { x: -4, y: -2 },
    { x: 2, y: 4 },
    { x: 2, y: -4 },
    { x: -2, y: 4 },
    { x: -2, y: -4 },
  ]),
  buildFootprintForEndpoint: (endpoint: TileCoord) => {
    // Validate: must be a legal endpoint.
    const ok = KNIGHT_SHOT.endpoints.some((e) => eq(e, endpoint));
    if (!ok) return [];

    // Knight x1: direct landing only.
    if (isKnightEndpoint(endpoint)) {
      return [{ x: endpoint.x, y: endpoint.y }];
    }

    // Knight x2: midpoint landing, then endpoint.
    if (isDoubleKnightEndpoint(endpoint)) {
      const mid = { x: endpoint.x / 2, y: endpoint.y / 2 };
      return [mid, { x: endpoint.x, y: endpoint.y }];
    }

    return [];
  },
};

export const PATTERN_LIBRARY: Record<PatternId, PatternDef> = {
  knightShot: KNIGHT_SHOT,
};

export function getPatternDef(id: PatternId): PatternDef {
  const def = PATTERN_LIBRARY[id];
  if (!def) throw new Error(`Unknown PatternId "${String(id)}"`);
  return def;
}

/**
 * Runtime-friendly lookup when the caller only has a string (e.g. AttackProfile carries a string id).
 * Returns null instead of throwing.
 */
export function tryGetPatternDef(id: string): PatternDef | null {
  const def = (PATTERN_LIBRARY as Record<string, PatternDef | undefined>)[id];
  return def ?? null;
}
