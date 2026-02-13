import Phaser from "phaser";

import type { BoardConfig } from "../board/BoardConfig";
import type { TileCoord } from "./path";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import type { PathPreviewOverlay } from "./PathPreviewOverlay";
import { animateUnitAlongPath } from "./moveAnimator";

import type { GameModel } from "../sim/GameModel";
import type { ActionQueue } from "../sim/ActionQueue";
import type { GameEvent } from "../sim/GameEvents";
import type { UnitRenderer } from "../units/UnitRenderer";

type MoveCompletePayload = { unitId: string };

export class MovementController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private cfg: BoardConfig;

  private model: GameModel;
  private actions: ActionQueue;
  private unitRenderer: UnitRenderer;

  private moveOverlay: MoveRangeOverlay;
  private pathPreview: PathPreviewOverlay;

  private selectedUnitId: string | null = null;
  private moveRangeEnabled = false;

  private hoverTile: TileCoord | null = null;
  private reachable: TileCoord[] = [];

  private isAnimating = false;

  private listeners = new Map<string, Array<(payload: any) => void>>();

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    cfg: BoardConfig;
    model: GameModel;
    actions: ActionQueue;
    unitRenderer: UnitRenderer;
    moveOverlay: MoveRangeOverlay;
    pathPreview: PathPreviewOverlay;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.cfg = args.cfg;

    this.model = args.model;
    this.actions = args.actions;
    this.unitRenderer = args.unitRenderer;

    this.moveOverlay = args.moveOverlay;
    this.pathPreview = args.pathPreview;

    // Cheap: re-render hover preview each frame so camera movement/zoom stays consistent.
    this.scene.events.on("postupdate", () => {
      if (this.moveRangeEnabled) this.redrawHoverPreview();
    });
  }

  on(event: "move:complete", cb: (p: MoveCompletePayload) => void) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb as any);
    this.listeners.set(event, arr);
  }

  private emit(event: string, payload: any) {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (const cb of arr) cb(payload);
  }

  isAnimatingMove(): boolean {
    return this.isAnimating;
  }

  /** Used by snapshot sync/reconciliation to stop client-side movement visuals. */
  cancelInFlightMove() {
    this.isAnimating = false;
    this.unitRenderer.resetVisualAnimations();
    this.pathPreview.clear();
  }

  setMoveRangeEnabled(enabled: boolean, budget?: number) {
    this.moveRangeEnabled = enabled;

    const unit = this.getSelectedUnit();
    if (!enabled || !unit) {
      this.reachable = [];
      this.moveOverlay.setReachableTiles([]);
      this.pathPreview.clear();
      return;
    }

    const maxSteps = Math.max(0, budget ?? this.model.getRemainingActionPoints(unit));

    // Derived data comes from sim (authoritative).
    this.reachable = this.model.getReachableTiles(unit.id, maxSteps, this.cfg);
    this.moveOverlay.setReachableTiles(this.reachable);

    this.redrawHoverPreview();
  }

  setSelectedUnitId(unitId: string | null, budget?: number) {
    this.selectedUnitId = unitId;
    this.setMoveRangeEnabled(!!unitId, budget);
  }

  setHoverTile(tile: TileCoord | null) {
    this.hoverTile = tile;
    this.redrawHoverPreview();
  }

  getHoverTile(): TileCoord | null {
    return this.hoverTile;
  }

  /**
   * Animates an already-applied move path (no ActionQueue submit).
   * Optionally applies staged events after the animation completes.
   */
  animateAppliedMove(unitId: string, path: TileCoord[], postMoveEvents?: GameEvent[], onFinished?: () => void): boolean {
    const finish = () => {
      if (postMoveEvents && postMoveEvents.length > 0) this.actions.applyDeferredEvents(postMoveEvents);

      const uNow = this.model.getUnitById(unitId);
      if (uNow) this.setMoveRangeEnabled(this.moveRangeEnabled, this.model.getRemainingActionPoints(uNow));

      this.emit("move:complete", { unitId });
      onFinished?.();
    };

    if (!path || path.length < 2) {
      finish();
      return false;
    }

    const dest = path[path.length - 1];
    const go = this.unitRenderer.getUnitDisplayObject(unitId);

    if (!go) {
      // No visual object: snap to final tile and still apply staged events.
      this.unitRenderer.setUnitVisualTile(unitId, dest.x, dest.y);
      finish();
      return false;
    }

    this.unitRenderer.setUnitExternallyAnimating(unitId, true);
    this.isAnimating = true;

    // Visual-only: start walk animation + set facing using the first step.
    this.unitRenderer.playMoveStart(unitId, path);

    animateUnitAlongPath(this.scene, go, path, this.tileToWorld, () => {
      this.isAnimating = false;

      this.unitRenderer.setUnitVisualTile(unitId, dest.x, dest.y);
      this.unitRenderer.setUnitExternallyAnimating(unitId, false);

      // Visual-only: return to idle pose after movement ends.
      this.unitRenderer.playIdle(unitId);

      finish();
    });

    return true;
  }

  /**
   * User-initiated move from clicking a reachable tile.
   * All validation happens in sim via ActionQueue.
   */
  tryMoveTo(dest: TileCoord): boolean {
    if (this.isAnimating) return false;

    const unit = this.getSelectedUnit();
    if (!unit) return false;

    const res = this.actions.submitLocal({ type: "move", unitId: unit.id, to: dest });
    if (!res.ok) return false;

    const path = res.movePath ?? [];
    if (path.length < 2) return false;

    return this.animateAppliedMove(unit.id, path, undefined);
  }

  // ---- Internals ----

  private getSelectedUnit() {
    if (!this.selectedUnitId) return null;
    return this.model.getUnitById(this.selectedUnitId);
  }

  private redrawHoverPreview() {
    if (!this.moveRangeEnabled) {
      this.pathPreview.clear();
      return;
    }

    const unit = this.getSelectedUnit();
    const hover = this.hoverTile;

    if (!unit || !hover) {
      this.pathPreview.clear();
      return;
    }

    // Only preview tiles in reachable set (prevents showing invalid paths).
    const inReach = this.reachable.some((t) => t.x === hover.x && t.y === hover.y);
    if (!inReach) {
      this.pathPreview.clear();
      return;
    }

    const budget = this.model.getRemainingActionPoints(unit);
    const path = this.model.previewMovePath(unit.id, hover, budget, this.cfg);

    if (!path || path.length < 2) {
      this.pathPreview.clear();
      return;
    }

    this.pathPreview.setPath(path);
  }

  private tileToWorld = (t: TileCoord) => ({
    x: (t.x - t.y) * (this.cfg.tileW / 2),
    y: (t.x + t.y) * (this.cfg.tileH / 2),
  });
}
