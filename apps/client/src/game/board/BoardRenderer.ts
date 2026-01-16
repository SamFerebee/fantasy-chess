import Phaser from "phaser";
import type { BoardConfig } from "./BoardConfig";
import { isoToScreen, isTileEnabled } from "./iso";

export type BoardBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class BoardRenderer {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cfg: BoardConfig, depth = 0) {
    this.scene = scene;
    this.cfg = cfg;
    this.g = scene.add.graphics().setDepth(depth);
  }

  draw(originX = 0, originY = 0): BoardBounds {
    const cfg = this.cfg;

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    const updateBounds = (x: number, y: number) => {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    // Tiles
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        if (!isTileEnabled(x, y, cfg)) continue;

        const { sx, sy } = isoToScreen(x, y, cfg);
        const cx = originX + sx;
        const cy = originY + sy;

        const p0 = new Phaser.Math.Vector2(cx, cy - cfg.tileH / 2);
        const p1 = new Phaser.Math.Vector2(cx + cfg.tileW / 2, cy);
        const p2 = new Phaser.Math.Vector2(cx, cy + cfg.tileH / 2);
        const p3 = new Phaser.Math.Vector2(cx - cfg.tileW / 2, cy);

        this.g.fillStyle(cfg.baseFill, 1);
        this.g.fillPoints([p0, p1, p2, p3], true);

        updateBounds(p0.x, p0.y);
        updateBounds(p1.x, p1.y);
        updateBounds(p2.x, p2.y);
        updateBounds(p3.x, p3.y);
      }
    }

    // Grid lines
    this.g.lineStyle(2, 0xffffff, 0.30);
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        if (!isTileEnabled(x, y, cfg)) continue;

        const { sx, sy } = isoToScreen(x, y, cfg);
        const cx = originX + sx;
        const cy = originY + sy;

        const p0 = new Phaser.Math.Vector2(cx, cy - cfg.tileH / 2);
        const p1 = new Phaser.Math.Vector2(cx + cfg.tileW / 2, cy);
        const p2 = new Phaser.Math.Vector2(cx, cy + cfg.tileH / 2);
        const p3 = new Phaser.Math.Vector2(cx - cfg.tileW / 2, cy);

        this.g.strokePoints([p0, p1, p2, p3], true);
      }
    }

    return { minX, minY, maxX, maxY };
  }
}
