import Phaser from "phaser";
import type { TileCoord } from "./path";

type WorldPoint = { x: number; y: number };

export class PathPreviewOverlay {
  private g: Phaser.GameObjects.Graphics;
  private tileToWorld: (t: TileCoord) => WorldPoint;
  private tileW: number;
  private tileH: number;

  constructor(
    scene: Phaser.Scene,
    tileToWorld: (t: TileCoord) => WorldPoint,
    tileW: number,
    tileH: number
  ) {
    this.tileToWorld = tileToWorld;
    this.tileW = tileW;
    this.tileH = tileH;

    this.g = scene.add.graphics();
    this.g.setDepth(50);
    this.g.setVisible(false);
  }

  clear(): void {
    this.g.clear();
    this.g.setVisible(false);
  }

  setPath(path: TileCoord[]): void {
    if (!path || path.length < 2) {
      this.clear();
      return;
    }

    this.g.clear();
    this.g.setVisible(true);

    // Draw discrete tile highlights (diamonds), skipping the start tile so we don't cover the unit.
    // Tweak these if you want a tighter/looser highlight.
    const inset = 0.70; // 1.0 = full tile diamond, smaller = inset diamond
    const hw = (this.tileW / 2) * inset;
    const hh = (this.tileH / 2) * inset;

    // Fill + outline
    this.g.fillStyle(0xffffff, 0.22);
    this.g.lineStyle(2, 0xffffff, 0.65);

    for (let i = 1; i < path.length; i++) {
      const t = path[i];
      const p = this.tileToWorld(t);

      const top = { x: p.x, y: p.y - hh };
      const right = { x: p.x + hw, y: p.y };
      const bot = { x: p.x, y: p.y + hh };
      const left = { x: p.x - hw, y: p.y };

      this.g.beginPath();
      this.g.moveTo(top.x, top.y);
      this.g.lineTo(right.x, right.y);
      this.g.lineTo(bot.x, bot.y);
      this.g.lineTo(left.x, left.y);
      this.g.closePath();

      this.g.fillPath();
      this.g.strokePath();
    }
  }

  destroy(): void {
    this.g.destroy();
  }
}
