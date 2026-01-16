import Phaser from "phaser";
import { BOARD } from "../board/BoardConfig";
import { isoToScreen, isTileEnabled } from "../board/iso";

export class BoardScene extends Phaser.Scene {
  create() {
    const cfg = BOARD;

    const g = this.add.graphics();
    g.setDepth(0);

    // Draw around world origin; fit camera after.
    const originX = 0;
    const originY = 0;

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

    // Solid tile fill
    for (let y = 0; y < cfg.rows; y++) {
      for (let x = 0; x < cfg.cols; x++) {
        if (!isTileEnabled(x, y, cfg)) continue;

        const { sx, sy } = isoToScreen(x, y, cfg);
        const cx = originX + sx;
        const cy = originY + sy;

        const p0 = new Phaser.Math.Vector2(cx, cy - cfg.tileH / 2); // top
        const p1 = new Phaser.Math.Vector2(cx + cfg.tileW / 2, cy); // right
        const p2 = new Phaser.Math.Vector2(cx, cy + cfg.tileH / 2); // bottom
        const p3 = new Phaser.Math.Vector2(cx - cfg.tileW / 2, cy); // left

        g.fillStyle(cfg.baseFill, 1);
        g.fillPoints([p0, p1, p2, p3], true);

        updateBounds(p0.x, p0.y);
        updateBounds(p1.x, p1.y);
        updateBounds(p2.x, p2.y);
        updateBounds(p3.x, p3.y);
      }
    }

    // Grid lines on top
    g.lineStyle(2, 0xffffff, 0.30);
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

        g.strokePoints([p0, p1, p2, p3], true);
      }
    }

    // Fit camera so entire board is visible, then zoom out a bit more
    const cam = this.cameras.main;
    const pad = 60;

    const boundsW = (maxX - minX) + pad * 2;
    const boundsH = (maxY - minY) + pad * 2;

    const fitZoom = Math.min(cam.width / boundsW, cam.height / boundsH) * 0.98;
    cam.setZoom(fitZoom * cfg.zoomOutFactor);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    cam.centerOn(centerX, centerY);
  }
}
