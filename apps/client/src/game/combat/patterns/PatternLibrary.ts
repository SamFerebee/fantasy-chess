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
   * Example: knight shot endpoints are the 8 L-shaped offsets.
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

function sign(n: number): -1 | 0 | 1 {
  if (n > 0) return 1;
  if (n < 0) return -1;
  return 0;
}

/**
 * "Knight shot" (MVP): L-shaped endpoint with a deterministic, step-wise footprint.
 *
 * Endpoints: (+/-2,+/-1) and (+/-1,+/-2).
 * Footprint convention:
 * - Walk the longer axis first (2 steps), then turn to finish the shorter axis (1 step).
 * - Example endpoint ( +2, +1 ): ( +1,0 ) -> ( +2,0 ) -> ( +2,+1 )
 * - Example endpoint ( +1, +2 ): ( 0,+1 ) -> ( 0,+2 ) -> ( +1,+2 )
 */
export const KNIGHT_SHOT: PatternDef = {
  id: "knightShot",
  maxRange: 3,
  endpoints: Object.freeze([
    { x: 2, y: 1 },
    { x: 2, y: -1 },
    { x: -2, y: 1 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
    { x: 1, y: -2 },
    { x: -1, y: 2 },
    { x: -1, y: -2 },
  ]),
  buildFootprintForEndpoint: (endpoint: TileCoord) => {
    // Validate: must be a legal endpoint.
    const ok = KNIGHT_SHOT.endpoints.some((e) => eq(e, endpoint));
    if (!ok) return [];

    const ax = Math.abs(endpoint.x);
    const ay = Math.abs(endpoint.y);

    const sx = sign(endpoint.x);
    const sy = sign(endpoint.y);

    const out: TileCoord[] = [];

    // Longer axis first (2 steps), then shorter (1 step).
    if (ax === 2 && ay === 1) {
      out.push({ x: 1 * sx, y: 0 });
      out.push({ x: 2 * sx, y: 0 });
      out.push({ x: 2 * sx, y: 1 * sy });
      return out;
    }

    if (ax === 1 && ay === 2) {
      out.push({ x: 0, y: 1 * sy });
      out.push({ x: 0, y: 2 * sy });
      out.push({ x: 1 * sx, y: 2 * sy });
      return out;
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
