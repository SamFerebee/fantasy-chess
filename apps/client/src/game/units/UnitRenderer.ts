import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { RenderStateStore, RenderUnitState } from "../render/RenderStateStore";

type UnitGO =
  | { unitId: string; kind: "circle"; go: Phaser.GameObjects.Arc; radius: number }
  | { unitId: string; kind: "rect"; go: Phaser.GameObjects.Rectangle; radius: number };

export class UnitRenderer {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private store: RenderStateStore;

  private gosById = new Map<string, UnitGO>();
  private selectedUnitId: string | null = null;

  private externallyAnimating = new Set<string>();

  private lastRevision = -1;

  constructor(scene: Phaser.Scene, cfg: BoardConfig, store: RenderStateStore) {
    this.scene = scene;
    this.cfg = cfg;
    this.store = store;
  }

  create() {
    this.reconcileWithStore(true);
    this.scene.events.on("postupdate", () => this.reconcileWithStore(false));
  }

  setSelectedUnitId(unitId: string | null) {
    this.selectedUnitId = unitId;
    this.applySelectionVisuals();
  }

  getSelectedUnitId(): string | null {
    return this.selectedUnitId;
  }

  getUnitDisplayObject(unitId: string): Phaser.GameObjects.GameObject | null {
    const go = this.gosById.get(unitId);
    return go ? go.go : null;
  }

  setUnitExternallyAnimating(unitId: string, animating: boolean) {
    if (animating) this.externallyAnimating.add(unitId);
    else this.externallyAnimating.delete(unitId);
  }

  setUnitVisualTile(unitId: string, x: number, y: number) {
    const { sx, sy } = isoToScreen(x, y, this.cfg);
    const go = this.gosById.get(unitId);
    if (!go) return;
    go.go.setPosition(sx, sy);
  }

  destroyUnitVisual(unitId: string) {
    const go = this.gosById.get(unitId);
    if (!go) return;
    go.go.destroy();
    this.gosById.delete(unitId);

    if (this.selectedUnitId === unitId) this.selectedUnitId = null;
    this.applySelectionVisuals();
  }

  /** For snapshot sync / reconciliation: kill tweens + drop external animation locks. */
  resetVisualAnimations() {
    for (const go of this.gosById.values()) {
      this.scene.tweens.killTweensOf(go.go as any);
    }
    this.externallyAnimating.clear();
  }

  /** Force an immediate full reconcile from the RenderStateStore. */
  forceSyncFromStore() {
    this.reconcileWithStore(true);
  }

  private reconcileWithStore(force: boolean) {
    const rev = this.store.getRevision();
    if (!force && rev === this.lastRevision) return;
    this.lastRevision = rev;

    const units = this.store.getUnits();
    const liveIds = new Set<string>();

    for (const u of units) {
      liveIds.add(u.id);
      const existing = this.gosById.get(u.id);

      if (!existing) {
        this.gosById.set(u.id, this.createUnitGo(u));
        continue;
      }

      const expectedKind: UnitGO["kind"] = u.shape === "rect" ? "rect" : "circle";
      if (existing.kind !== expectedKind) {
        existing.go.destroy();
        this.gosById.set(u.id, this.createUnitGo(u));
        continue;
      }

      if (!this.externallyAnimating.has(u.id)) {
        const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);
        existing.go.setPosition(sx, sy);
      }
    }

    for (const [unitId, go] of this.gosById.entries()) {
      if (liveIds.has(unitId)) continue;
      go.go.destroy();
      this.gosById.delete(unitId);
      this.externallyAnimating.delete(unitId);
      if (this.selectedUnitId === unitId) this.selectedUnitId = null;
    }

    this.applySelectionVisuals();
  }

  private createUnitGo(u: RenderUnitState): UnitGO {
    const radius = Math.max(10, Math.floor(this.cfg.tileH * 0.35));
    const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);

    const fill = u.team === "A" ? 0x5aa7ff : 0xff6b6b;

    if (u.shape === "rect") {
      const w = Math.floor(this.cfg.tileW * 0.55);
      const h = Math.floor(this.cfg.tileH * 0.55);
      const rect = this.scene.add.rectangle(sx, sy, w, h, fill, 1).setDepth(5);
      return { unitId: u.id, kind: "rect", go: rect, radius };
    }

    const circle = this.scene.add.circle(sx, sy, radius, fill, 1).setDepth(5);
    return { unitId: u.id, kind: "circle", go: circle, radius };
  }

  private applySelectionVisuals() {
    for (const go of this.gosById.values()) {
      const selected = go.unitId === this.selectedUnitId;
      (go.go as any).setStrokeStyle(selected ? 3 : 0, 0xffffff, selected ? 0.95 : 0);
    }
  }
}
