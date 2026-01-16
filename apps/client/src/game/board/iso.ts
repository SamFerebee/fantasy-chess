import type { BoardConfig } from "./BoardConfig";

export function isoToScreen(x: number, y: number, cfg: BoardConfig) {
  return {
    sx: (x - y) * (cfg.tileW / 2),
    sy: (x + y) * (cfg.tileH / 2),
  };
}

// Diagonal corner cutouts (TAO-like)
export function isTileEnabled(x: number, y: number, cfg: BoardConfig) {
  const { cols, rows, cornerCut } = cfg;

  if (x + y < cornerCut) return false; // top-left
  if ((cols - 1 - x) + y < cornerCut) return false; // top-right
  if (x + (rows - 1 - y) < cornerCut) return false; // bottom-left
  if ((cols - 1 - x) + (rows - 1 - y) < cornerCut) return false; // bottom-right

  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function pointInDiamond(
  px: number,
  py: number,
  cx: number,
  cy: number,
  halfW: number,
  halfH: number
) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  return dx / halfW + dy / halfH <= 1;
}

function tileContainsWorldPoint(worldX: number, worldY: number, tx: number, ty: number, cfg: BoardConfig) {
  const { sx, sy } = isoToScreen(tx, ty, cfg);
  return pointInDiamond(worldX, worldY, sx, sy, cfg.tileW / 2, cfg.tileH / 2);
}

export type TileHit = { x: number; y: number };

/**
 * Convert a world-space point (camera-adjusted) to a tile coordinate.
 * Returns null if the point isn't inside any valid tile.
 */
export function screenToIso(worldX: number, worldY: number, cfg: BoardConfig): TileHit | null {
  const halfW = cfg.tileW / 2;
  const halfH = cfg.tileH / 2;

  // Inverse mapping from world (sx,sy) -> (x,y)
  const fx = (worldY / halfH + worldX / halfW) / 2;
  const fy = (worldY / halfH - worldX / halfW) / 2;

  const rx = Math.round(fx);
  const ry = Math.round(fy);

  // Search nearby tiles to get correct hit near edges
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = rx + dx;
      const y = ry + dy;
      if (!isTileEnabled(x, y, cfg)) continue;
      if (tileContainsWorldPoint(worldX, worldY, x, y, cfg)) return { x, y };
    }
  }

  return null;
}
