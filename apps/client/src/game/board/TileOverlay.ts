import Phaser from "phaser";
import type { BoardConfig } from "./BoardConfig";
import { isoToScreen } from "./iso";

export type TileHit = { x: number; y: number } | null;

export class TileOverlay {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;

  private hoverG: Phaser.GameObjects.Graphics;
  private selectG: Phaser.GameObjects.Graphics;

  private hovered: TileHit = null;
  private selected: TileHit = null;

  constructor(scene: Phaser.Scene, cfg: BoardConfig) {
    this.scene = scene;
    this.cfg = cfg;
    this.selectG = scene.add.graphics().setDepth(9);
    this.hoverG = scene.add.graphics().setDepth(10);
  }

  setHovered(hit: TileHit) {
    const changed = hit?.x !== this.hovered?.x || hit?.y !== this.hovered?.y;
    this.hovered = hit;
    if (changed) this.redraw();
  }

  setSelected(hit: TileHit) {
    this.selected = hit;
    this.redraw();
  }

  private drawTile(g: Phaser.GameObjects.Graphics, x: number, y: number, lineAlpha: number, fillAlpha: number) {
    const { sx, sy } = isoToScreen(x, y, this.cfg);
    const cx = sx;
    const cy = sy;

    const p0 = new Phaser.Math.Vector2(cx, cy - this.cfg.tileH / 2);
    const p1 = new Phaser.Math.Vector2(cx + this.cfg.tileW / 2, cy);
    const p2 = new Phaser.Math.Vector2(cx, cy + this.cfg.tileH / 2);
    const p3 = new Phaser.Math.Vector2(cx - this.cfg.tileW / 2, cy);

    g.fillStyle(0xffffff, fillAlpha);
    g.fillPoints([p0, p1, p2, p3], true);

    g.lineStyle(3, 0xffffff, lineAlpha);
    g.strokePoints([p0, p1, p2, p3], true);
  }

  private redraw() {
    this.hoverG.clear();
    this.selectG.clear();

    if (this.selected) this.drawTile(this.selectG, this.selected.x, this.selected.y, 0.9, 0.10);
    if (this.hovered) this.drawTile(this.hoverG, this.hovered.x, this.hovered.y, 0.9, 0.06);
  }
}
