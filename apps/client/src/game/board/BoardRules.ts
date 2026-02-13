/**
 * Board rules configuration.
 *
 * This is intentionally a strict subset of BoardConfig (render config).
 * Anything in this type must be safe/necessary for server-authoritative simulation.
 */
export type BoardRulesConfig = {
  cols: number;
  rows: number;

  /** Corner cutouts (square cut at each corner). 1 = remove 1 tile at each corner. */
  cornerCut: number;
};

/**
 * Pure rules helper (no rendering concerns).
 */
export function isInBoundsAndNotCutout(x: number, y: number, cfg: BoardRulesConfig): boolean {
  if (x < 0 || y < 0 || x >= cfg.cols || y >= cfg.rows) return false;

  const c = cfg.cornerCut;
  if (c > 0) {
    const maxX = cfg.cols - 1;
    const maxY = cfg.rows - 1;

    const inTL = x < c && y < c;
    const inTR = x > maxX - c && y < c;
    const inBL = x < c && y > maxY - c;
    const inBR = x > maxX - c && y > maxY - c;

    if (inTL || inTR || inBL || inBR) return false;
  }

  return true;
}

/**
 * Convenience: derive rules config from any object that contains the needed fields
 * (e.g., BoardConfig on the client).
 */
export function toBoardRules(cfg: { cols: number; rows: number; cornerCut: number }): BoardRulesConfig {
  return { cols: cfg.cols, rows: cfg.rows, cornerCut: cfg.cornerCut };
}
