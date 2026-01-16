import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { Unit } from "./UnitTypes";

type UnitGO =
  | { unit: Unit; kind: "circle"; go: Phaser.GameObjects.Arc; radius: number }
  | { unit: Unit; kind: "tri"; go: Phaser.GameObjects.Triangle; radius: number };

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
    const yOffset = 0;

    for (const u of this.units) {
      const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);
      const px = sx;
      const py = sy + yOffset;

      const fill = u.team === "A" ? 0x5aa7ff : 0xff6b6b;

      if (u.shape === "triangle") {
        const tri = this.scene.add
          .triangle(
            px,
            py,
            0,
            -radius,
            radius,
            radius,
            -radius,
            radius,
            fill,
            1
          )
          .setDepth(5);

        // Rotate to align better with isometric diamond
        tri.setRotation(Phaser.Math.DegToRad(45));

        this.gos.push({ unit: u, kind: "tri", go: tri, radius });
      } else {
        const circle = this.scene.add.circle(px, py, radius, fill, 1).setDepth(5);
        this.gos.push({ unit: u, kind: "circle", go: circle, radius });
      }
    }

    this.applySelectionVisuals();
  }

  setSelectedUnitId(unitId: string | null) {
    this.selectedUnitId = unitId;
    this.applySelectionVisuals();
  }

  getUnitAtTile(x: number, y: number) {
    return this.units.find((u) => u.x === x && u.y === y) ?? null;
  }

  pickUnitAtWorldPoint(worldX: number, worldY: number): Unit | null {
    for (let i = this.gos.length - 1; i >= 0; i--) {
      const go = this.gos[i];
      const dx = worldX - go.go.x;
      const dy = worldY - go.go.y;
      if (dx * dx + dy * dy <= go.radius * go.radius) return go.unit;
    }
    return null;
  }

  private applySelectionVisuals() {
    for (const go of this.gos) {
      const selected = go.unit.id === this.selectedUnitId;

      if (go.kind === "circle") {
        go.go.setStrokeStyle(selected ? 3 : 0, 0xffffff, selected ? 0.95 : 0);
      } else {
        go.go.setStrokeStyle(selected ? 3 : 0, 0xffffff, selected ? 0.95 : 0);
      }
    }
  }
}
