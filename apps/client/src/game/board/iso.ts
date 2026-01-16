import type { BoardConfig } from "./BoardConfig";

export function isoToScreen(x: number, y: number, cfg: BoardConfig) {
  return {
    sx: (x - y) * (cfg.tileW / 2),
    sy: (x + y) * (cfg.tileH / 2),
  };
}

export function isTileEnabled(x: number, y: number, cfg: BoardConfig) {
  const { cols, rows, cornerCut } = cfg;

  // Remove a diagonal "triangle" from each corner.
  // cornerCut=1 removes only the extreme corner tile.
  // cornerCut=2 removes a 3-tile triangle, etc.

  // Top-left
  if (x + y < cornerCut) return false;

  // Top-right
  if ((cols - 1 - x) + y < cornerCut) return false;

  // Bottom-left
  if (x + (rows - 1 - y) < cornerCut) return false;

  // Bottom-right
  if ((cols - 1 - x) + (rows - 1 - y) < cornerCut) return false;

  return true;
}
