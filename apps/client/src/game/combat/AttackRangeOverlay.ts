import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { TileCoord } from "../movement/path";

/**
 * Purely-visual overlay showing attackable tiles.
 *
 * IMPORTANT: This must not depend on sim Unit objects.
 */
export class AttackRangeOverlay {
  private cfg: BoardConfig;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cfg: BoardConfig) {
    this.cfg = cfg;
    this.gfx = scene.add.graphics().setDepth(45);
  }

  setTiles(tiles: TileCoord[]) {
    this.gfx.clear();

    if (!tiles || tiles.length === 0) return;

    this.gfx.fillStyle(0xff0000, 0.18);

    for (const t of tiles) {
      const { sx, sy } = isoToScreen(t.x, t.y, this.cfg);
      this.drawDiamond(sx, sy, this.cfg.tileW * 0.5, this.cfg.tileH * 0.5);
    }
  }

  clear() {
    this.gfx.clear();
  }

  private drawDiamond(cx: number, cy: number, halfW: number, halfH: number) {
    this.gfx.beginPath();
    this.gfx.moveTo(cx, cy - halfH);
    this.gfx.lineTo(cx + halfW, cy);
    this.gfx.lineTo(cx, cy + halfH);
    this.gfx.lineTo(cx - halfW, cy);
    this.gfx.closePath();
    this.gfx.fillPath();
  }
}
