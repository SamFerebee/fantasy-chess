import type { TileCoord } from "../../movement/path";

export type GridPoint = { x: number; y: number };
export type PreferAxis = "x" | "y";

/**
 * Deterministic grid traversal (Amanatides & Woo / DDA).
 *
 * Inputs are continuous points in "grid space" where each tile is [x,x+1)×[y,y+1).
 * Output is the ordered list of visited tile cells, including the start cell and end cell.
 *
 * Tie-break rule:
 * - When the segment hits a grid corner exactly (tMaxX === tMaxY), we advance only one axis,
 *   choosing `preferAxis` to avoid "supercover" behavior.
 */
export function traceGridDda(
  start: GridPoint,
  end: GridPoint,
  preferAxis: PreferAxis = "x",
  maxSteps: number = 512
): TileCoord[] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  let x = start.x;
  let y = start.y;

  let cellX = Math.floor(x);
  let cellY = Math.floor(y);

  const endCellX = Math.floor(end.x);
  const endCellY = Math.floor(end.y);

  const path: TileCoord[] = [{ x: cellX, y: cellY }];

  // Degenerate: start and end are in same cell.
  if (cellX === endCellX && cellY === endCellY) return path;

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  const tDeltaX = stepX !== 0 ? 1 / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const tDeltaY = stepY !== 0 ? 1 / Math.abs(dy) : Number.POSITIVE_INFINITY;

  const nextVert = stepX > 0 ? cellX + 1 : cellX; // next vertical grid line x
  const nextHorz = stepY > 0 ? cellY + 1 : cellY; // next horizontal grid line y

  // Division by dx/dy is safe because when step is 0, we set Infinity above.
  let tMaxX = stepX !== 0 ? (nextVert - x) / dx : Number.POSITIVE_INFINITY;
  let tMaxY = stepY !== 0 ? (nextHorz - y) / dy : Number.POSITIVE_INFINITY;

  let steps = 0;
  while ((cellX !== endCellX || cellY !== endCellY) && steps < maxSteps) {
    steps++;

    if (tMaxX < tMaxY) {
      cellX += stepX;
      tMaxX += tDeltaX;
    } else if (tMaxY < tMaxX) {
      cellY += stepY;
      tMaxY += tDeltaY;
    } else {
      // exact corner hit — advance only one axis deterministically
      if (preferAxis === "x") {
        cellX += stepX;
        tMaxX += tDeltaX;
      } else {
        cellY += stepY;
        tMaxY += tDeltaY;
      }
    }

    path.push({ x: cellX, y: cellY });
  }

  return path;
}
