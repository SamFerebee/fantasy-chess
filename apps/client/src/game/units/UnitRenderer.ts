import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { Unit } from "./UnitTypes";

type UnitGO =
  | { unit: Unit; kind: "circle"; go: Phaser.GameObjects.Arc; radius: number }
  | { unit: Unit; kind: "rect"; go: Phaser.GameObjects.Rectangle; radius: number };

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

    for (const u of this.units) {
      const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);
      const px = sx;
      const py = sy;

      const fill = u.team === "A" ? 0x5aa7ff : 0xff6b6b;

      if (u.shape === "rect") {
        const w = Math.floor(this.cfg.tileW * 0.55);
        const h = Math.floor(this.cfg.tileH * 0.55);

        const rect = this.scene.add.rectangle(px, py, w, h, fill, 1).setDepth(5);
        this.gos.push({ unit: u, kind: "rect", go: rect, radius });
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

  getSelectedUnit(): Unit | null {
    if (!this.selectedUnitId) return null;
    return this.units.find((u) => u.id === this.selectedUnitId) ?? null;
  }

  getUnitAtTile(x: number, y: number) {
    return this.units.find((u) => u.x === x && u.y === y) ?? null;
  }

  getUnitDisplayObject(unitId: string): Phaser.GameObjects.GameObject | null {
    const go = this.gos.find((g) => g.unit.id === unitId);
    return go ? go.go : null;
  }

  setUnitVisualTile(unitId: string, x: number, y: number) {
    const { sx, sy } = isoToScreen(x, y, this.cfg);

    const go = this.gos.find((g) => g.unit.id === unitId);
    if (!go) return;

    go.go.setPosition(sx, sy);
  }

  destroyUnitVisual(unitId: string) {
    const idx = this.gos.findIndex((g) => g.unit.id === unitId);
    if (idx === -1) return;

    this.gos[idx].go.destroy();
    this.gos.splice(idx, 1);

    if (this.selectedUnitId === unitId) this.selectedUnitId = null;
    this.applySelectionVisuals();
  }

  pickUnitAtWorldPoint(worldX: number, worldY: number): Unit | null {
    for (let i = this.gos.length - 1; i >= 0; i--) {
      const go = this.gos[i];

      if (go.kind === "rect") {
        const halfW = go.go.width * go.go.scaleX * 0.5;
        const halfH = go.go.height * go.go.scaleY * 0.5;

        if (
          worldX >= go.go.x - halfW &&
          worldX <= go.go.x + halfW &&
          worldY >= go.go.y - halfH &&
          worldY <= go.go.y + halfH
        ) {
          return go.unit;
        }
      } else {
        const dx = worldX - go.go.x;
        const dy = worldY - go.go.y;
        if (dx * dx + dy * dy <= go.radius * go.radius) return go.unit;
      }
    }
    return null;
  }

  private applySelectionVisuals() {
    for (const go of this.gos) {
      const selected = go.unit.id === this.selectedUnitId;
      go.go.setStrokeStyle(selected ? 3 : 0, 0xffffff, selected ? 0.95 : 0);
    }
  }
}
