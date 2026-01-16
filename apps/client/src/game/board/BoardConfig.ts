export type BoardConfig = {
  cols: number;
  rows: number;
  tileW: number;
  tileH: number;

  // Corner cutouts (square cut at each corner)
  cornerCut: number; // 1 = remove 1 tile at each corner

  // view / style
  zoomOutFactor: number; // < 1.0 zooms out
  baseFill: number;      // base grey
  fillJitter: number;    // random-ish variation per tile (0..1)
  lightDir: { x: number; y: number }; // for directional shading
};

export const BOARD: BoardConfig = {
  cols: 11,
  rows: 11,
  tileW: 80,
  tileH: 40,
  cornerCut: 2,

  zoomOutFactor: 0.85,

  baseFill: 0x3a3a3a,
  fillJitter: 0.10,
  lightDir: { x: -1, y: -1 }, // light from top-left like the reference
};
