import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { TileCoord } from "./path";

/**
 * Purely-visual overlay showing reachable move tiles.
 *
 * IMPORTANT: This must not depend on sim Unit objects.
 */
export class MoveRangeOverlay {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cfg: BoardConfig) {
    this.scene = scene;
    this.cfg = cfg;
    this.gfx = this.scene.add.graphics().setDepth(40);
  }

  setReachableTiles(reachableTiles: TileCoord[]) {
    this.gfx.clear();

    if (!reachableTiles || reachableTiles.length === 0) return;

    this.gfx.fillStyle(0x66ff66, 0.18);

    for (const t of reachableTiles) {
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
