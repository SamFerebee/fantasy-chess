import Phaser from "phaser";
import type { TileCoord } from "../movement/path";

type WorldPoint = { x: number; y: number };

export class ProjectilePathOverlay {
  private g: Phaser.GameObjects.Graphics;
  private tileToWorld: (t: TileCoord) => WorldPoint;
  private tileW: number;
  private tileH: number;

  constructor(scene: Phaser.Scene, tileToWorld: (t: TileCoord) => WorldPoint, tileW: number, tileH: number) {
    this.tileToWorld = tileToWorld;
    this.tileW = tileW;
    this.tileH = tileH;

    this.g = scene.add.graphics();
    this.g.setDepth(60); // above attack range overlay
    this.g.setVisible(false);
  }

  clear(): void {
    this.g.clear();
    this.g.setVisible(false);
  }

  /**
   * Path may include the attacker tile at index 0.
   * We skip index 0 to avoid covering the attacker unit.
   */
  setPath(path: TileCoord[]): void {
    if (!path || path.length < 2) {
      this.clear();
      return;
    }

    this.g.clear();
    this.g.setVisible(true);

    const overdraw = 1.03;
    const hw = (this.tileW / 2) * overdraw;
    const hh = (this.tileH / 2) * overdraw;

    // Stronger/bolder red than the attack range fill
    this.g.fillStyle(0xff0000, 0.32);
    this.g.lineStyle(3, 0xff0000, 0.85);

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
