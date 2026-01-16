import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { Unit } from "./UnitTypes";

type UnitGO = {
  unit: Unit;
  circle: Phaser.GameObjects.Arc;
  radius: number;
};

export class UnitRenderer {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private units: Unit[];
  private gos: UnitGO[] = [];
  private selectedUnitId: string | null = null;

  constructor(scene: Phaser.Scene, cfg: BoardConfig, units: Unit[]) {
    this.scene = scene;
    this.cfg = cfg;
    this.units = units;
  }

  create() {
    const radius = Math.max(10, Math.floor(this.cfg.tileH * 0.35));
    const yOffset = -Math.floor(this.cfg.tileH * 0.20);

    for (const u of this.units) {
      const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);

      const fill = u.team === "A" ? 0x5aa7ff : 0xff6b6b;

      const circle = this.scene.add
        .circle(sx, sy + yOffset, radius, fill, 1)
        .setDepth(5);

      this.gos.push({ unit: u, circle, radius });
    }

    this.applySelectionVisuals();
  }

  getSelectedUnit(): Unit | null {
    if (!this.selectedUnitId) return null;
    return this.units.find((u) => u.id === this.selectedUnitId) ?? null;
  }

  setSelectedUnitId(unitId: string | null) {
    this.selectedUnitId = unitId;
    this.applySelectionVisuals();
  }

  /**
   * Returns the unit under a WORLD point (camera-adjusted), or null.
   * Units take priority over tiles.
   */
  pickUnitAtWorldPoint(worldX: number, worldY: number): Unit | null {
    // Check top-most last (simple approach: reverse draw order)
    for (let i = this.gos.length - 1; i >= 0; i--) {
      const go = this.gos[i];
      const dx = worldX - go.circle.x;
      const dy = worldY - go.circle.y;
      if (dx * dx + dy * dy <= go.radius * go.radius) return go.unit;
    }
    return null;
  }

  private applySelectionVisuals() {
    for (const go of this.gos) {
      if (go.unit.id === this.selectedUnitId) {
        go.circle.setStrokeStyle(3, 0xffffff, 0.95);
      } else {
        go.circle.setStrokeStyle(); // clears stroke
      }
    }
  }

  getUnitAtTile(x: number, y: number) {
    return this.units.find((u) => u.x === x && u.y === y) ?? null;
  }

}
