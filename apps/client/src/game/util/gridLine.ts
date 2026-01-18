export type TileCoord = { x: number; y: number };

/**
 * Bresenham line on grid coordinates (x,y). Returns inclusive endpoints.
 */
export function bresenhamLine(x0: number, y0: number, x1: number, y1: number): TileCoord[] {
  const out: TileCoord[] = [];

  let x = x0;
  let y = y0;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);

  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;

  let err = dx - dy;

  while (true) {
    out.push({ x, y });
    if (x === x1 && y === y1) break;

    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }

  return out;
}
