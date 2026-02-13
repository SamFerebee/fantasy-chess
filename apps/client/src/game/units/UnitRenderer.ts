import Phaser from "phaser";

import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { RenderStateStore, RenderUnitState } from "../render/RenderStateStore";

import {
  GEN_KNIGHT_SHEET_KEY,
  actionDurationMs,
  isoFacingFromTiles,
  knightAnimKey,
  type IsoFacing4,
  type KnightAction,
} from "../assets/GeneratedKnightSpriteSheet";
import type { TileCoord } from "../movement/path";

type ShapeUnitGO =
  | { unitId: string; kind: "circle"; go: Phaser.GameObjects.Arc; radius: number }
  | { unitId: string; kind: "rect"; go: Phaser.GameObjects.Rectangle; radius: number };

type SpriteUnitGO = {
  unitId: string;
  kind: "sprite";
  go: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  outline: Phaser.GameObjects.Ellipse;
  radius: number;
  facing: IsoFacing4;
  action: KnightAction;
};

type UnitGO = ShapeUnitGO | SpriteUnitGO;

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

  // ---------------------------------------------------------------------------
  // Knight (generated sheet) animation helpers
  // ---------------------------------------------------------------------------

  /** Called by MovementController before it tweens the unit along a path. */
  playMoveStart(unitId: string, path: TileCoord[]) {
    const go = this.gosById.get(unitId);
    if (!go || go.kind !== "sprite") return;
    if (!path || path.length < 2) return;

    const facing = isoFacingFromTiles(this.cfg, path[0], path[1]);
    this.playKnightAction(unitId, "walk", facing);
  }

  /** Called by MovementController after the tween completes. */
  playMoveEnd(unitId: string) {
    this.playKnightIdle(unitId);
  }

  /** Called by ClientEventEffects when an attacker swings/shoots. */
  playAttackOnce(attackerId: string, attackerTile: TileCoord, targetTile: TileCoord) {
    const go = this.gosById.get(attackerId);
    if (!go || go.kind !== "sprite") return;

    const facing = isoFacingFromTiles(this.cfg, attackerTile, targetTile);
    this.playKnightAction(attackerId, "attack", facing);
    this.scene.time.delayedCall(actionDurationMs("attack"), () => this.playKnightIdle(attackerId), undefined, this);
  }

  /** Called by ClientEventEffects when a unit is hit (non-zero damage). */
  playHitOnce(targetId: string, targetTile: TileCoord, attackerTile: TileCoord) {
    const go = this.gosById.get(targetId);
    if (!go || go.kind !== "sprite") return;

    const facingTowardAttacker = isoFacingFromTiles(this.cfg, targetTile, attackerTile);
    this.playKnightAction(targetId, "hit", facingTowardAttacker);
    this.scene.time.delayedCall(actionDurationMs("hit"), () => this.playKnightIdle(targetId), undefined, this);
  }

  /** Called by ClientEventEffects when damage is zero (treated as a "block" feel). */
  playBlockOnce(targetId: string, targetTile: TileCoord, attackerTile: TileCoord) {
    const go = this.gosById.get(targetId);
    if (!go || go.kind !== "sprite") return;

    const facingTowardAttacker = isoFacingFromTiles(this.cfg, targetTile, attackerTile);
    this.playKnightAction(targetId, "block", facingTowardAttacker);
    this.scene.time.delayedCall(actionDurationMs("block"), () => this.playKnightIdle(targetId), undefined, this);
  }

  /** Called by ClientEventEffects before the render-store finalizes removal. */
  playDeathOnce(unitId: string) {
    const go = this.gosById.get(unitId);
    if (!go || go.kind !== "sprite") return;

    // Keep the unit facing as-is; death should read regardless.
    this.playKnightAction(unitId, "death", go.facing);
  }

  /** Useful for callers that only want to reset to idle. */
  playKnightIdle(unitId: string) {
    const go = this.gosById.get(unitId);
    if (!go || go.kind !== "sprite") return;
    this.playKnightAction(unitId, "idle", go.facing);
  }

  // ---------------------------------------------------------------------------
  // Public wrappers (so other modules can stay simple)
  // ---------------------------------------------------------------------------

  /** Generic reset to idle (no-op for placeholder shapes). */
  playIdle(unitId: string) {
    this.playKnightIdle(unitId);
  }

  /** Best-effort: play attack once for sprite units (no-op for shapes). */
  playAttack(attackerId: string, attackerTile: TileCoord, targetTile: TileCoord) {
    this.playAttackOnce(attackerId, attackerTile, targetTile);
  }

  /** Best-effort: play hit once for sprite units (no-op for shapes). */
  playHit(targetId: string, targetTile: TileCoord, attackerTile: TileCoord) {
    this.playHitOnce(targetId, targetTile, attackerTile);
  }

  /** Best-effort: play block once for sprite units (no-op for shapes). */
  playBlock(targetId: string, targetTile: TileCoord, attackerTile: TileCoord) {
    this.playBlockOnce(targetId, targetTile, attackerTile);
  }

  /** Best-effort: show death pose for sprite units (no-op for shapes). */
  playDeath(unitId: string) {
    this.playDeathOnce(unitId);
  }

  private playKnightAction(unitId: string, action: KnightAction, facing: IsoFacing4) {
    const go = this.gosById.get(unitId);
    if (!go || go.kind !== "sprite") return;

    go.facing = facing;
    go.action = action;

    const anim = knightAnimKey(action, facing);
    go.sprite.anims.play(anim, true);
  }

  // ---------------------------------------------------------------------------

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

      const expectedKind = this.expectedGoKind(u);
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

  private expectedGoKind(u: RenderUnitState): UnitGO["kind"] {
    // Minimal first-pass mapping:
    // - fighter => generated knight spritesheet (if loaded)
    // - everything else => legacy placeholder shapes
    const knightAvailable = this.scene.textures.exists(GEN_KNIGHT_SHEET_KEY);
    if (knightAvailable && u.name === "fighter") return "sprite";
    return u.shape === "rect" ? "rect" : "circle";
  }

  private createUnitGo(u: RenderUnitState): UnitGO {
    const radius = Math.max(10, Math.floor(this.cfg.tileH * 0.35));
    const { sx, sy } = isoToScreen(u.x, u.y, this.cfg);

    const knightAvailable = this.scene.textures.exists(GEN_KNIGHT_SHEET_KEY);
    if (knightAvailable && u.name === "fighter") {
      const container = this.scene.add.container(sx, sy).setDepth(6);

      const sprite = this.scene.add.sprite(0, 0, GEN_KNIGHT_SHEET_KEY, 0);

      // FIX: fit the 256x256 frames to your tile size
      // Tune these multipliers to taste; these defaults keep the unit readable without dominating the board.
      const targetW = Math.floor(this.cfg.tileW * 1.00);
      const targetH = Math.floor(this.cfg.tileH * 2.00);
      sprite.setDisplaySize(targetW, targetH);

      // Anchor slightly toward the "feet" so it sits on the tile.
      sprite.setOrigin(0.5, 0.86);

      // Selection outline: an ellipse on the ground plane.
      const ringW = Math.floor(this.cfg.tileW * 0.55);
      const ringH = Math.floor(this.cfg.tileH * 0.22);
      const outline = this.scene.add.ellipse(0, Math.floor(this.cfg.tileH * 0.18), ringW, ringH);
      outline.setStrokeStyle(2, 0xffffff, 0.95);
      outline.setFillStyle(0x000000, 0);
      outline.setVisible(false);

      container.add(outline);
      container.add(sprite);

      const facing: IsoFacing4 = u.team === "A" ? "SE" : "SW";
      sprite.anims.play(knightAnimKey("idle", facing), true);

      return {
        unitId: u.id,
        kind: "sprite",
        go: container,
        sprite,
        outline,
        radius,
        facing,
        action: "idle",
      };
    }

    // Shape fallback
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

      if (go.kind === "sprite") {
        go.outline.setVisible(selected);
        continue;
      }

      (go.go as any).setStrokeStyle(selected ? 3 : 0, 0xffffff, selected ? 0.95 : 0);
    }
  }
}
