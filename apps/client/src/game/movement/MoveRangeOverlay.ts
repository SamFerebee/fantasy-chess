import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { Unit } from "../units/UnitTypes";
import { computeReachableTiles } from "./reachable";

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

export class MoveRangeOverlay {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private g: Phaser.GameObjects.Graphics;

  private units: Unit[];

  constructor(scene: Phaser.Scene, cfg: BoardConfig, units: Unit[]) {
    this.scene = scene;
    this.cfg = cfg;
    this.units = units;
    this.g = scene.add.graphics().setDepth(4); // below units (5), above board (0)
  }

  setSelectedUnit(unit: Unit | null) {
    this.g.clear();
    if (!unit) return;

    // Block entering any occupied tile except the selected unit’s own tile
    const blocked = new Set<string>();
    for (const u of this.units) {
      if (u.id === unit.id) continue;
      blocked.add(tileKey(u.x, u.y));
    }

    const tiles = computeReachableTiles({
      cfg: this.cfg,
      start: { x: unit.x, y: unit.y },
      moveRange: unit.moveRange,
      blocked,
    });

    // Visual: translucent fill + thin outline
// Visual: stronger translucent fill + clearer outline
    for (const t of tiles) {
    const { sx, sy } = isoToScreen(t.x, t.y, this.cfg);
    const cx = sx;
    const cy = sy;

    const p0 = new Phaser.Math.Vector2(cx, cy - this.cfg.tileH / 2);
    const p1 = new Phaser.Math.Vector2(cx + this.cfg.tileW / 2, cy);
    const p2 = new Phaser.Math.Vector2(cx, cy + this.cfg.tileH / 2);
    const p3 = new Phaser.Math.Vector2(cx - this.cfg.tileW / 2, cy);

    this.g.fillStyle(0xffffff, 0.20);      // was 0.08
    this.g.fillPoints([p0, p1, p2, p3], true);

    this.g.lineStyle(2.5, 0xffffff, 0.55); // was 1.5 / 0.25
    this.g.strokePoints([p0, p1, p2, p3], true);
    }

  }
}
