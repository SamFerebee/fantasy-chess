import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { TileCoord } from "../movement/path";
import type { Unit } from "../units/UnitTypes";

export class AttackRangeOverlay {
  private cfg: BoardConfig;
  private gfx: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, cfg: BoardConfig) {
    this.cfg = cfg;
    this.gfx = scene.add.graphics().setDepth(45);
  }

  setSelectedUnit(_unit: Unit | null, tiles: TileCoord[]) {
    this.gfx.clear();

    if (!tiles || tiles.length === 0) return;

    // red, see-through
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
