import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import type { PathPreviewOverlay } from "./PathPreviewOverlay";
import type { TileCoord } from "./path";

import { animateUnitAlongPath } from "./moveAnimator";
import { buildBlockedSet, computeReachableTiles, isInBoundsAndNotCutout } from "./movementRules";
import { getPathForMove } from "./pathing";
import type { GameModel } from "../sim/GameModel";
import type { ActionQueue } from "../sim/ActionQueue";

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

    this.scene.events.on("postupdate", () => {
      // Keep hover path preview fresh while moving camera/zoom
      if (this.moveRangeEnabled) this.redrawHoverPreview();
    });
  }

  on(event: "move:complete", cb: (p: MoveCompletePayload) => void) {
    const arr = this.listeners.get(event) ?? [];
    arr.push(cb as any);
    this.listeners.set(event, arr);
  }

  emit(event: string, payload: any) {
    const arr = this.listeners.get(event);
    if (!arr) return;
    for (const cb of arr) cb(payload);
  }

  isAnimatingMove(): boolean {
    return this.isAnimating;
  }

  setMoveRangeEnabled(enabled: boolean, budget?: number) {
    this.moveRangeEnabled = enabled;

    const unit = this.getSelectedUnit();
    if (!enabled || !unit) {
      this.reachable = [];
      this.moveOverlay.setSelectedUnit(null, []);
      this.pathPreview.clear();
      return;
    }

    const maxSteps = Math.max(0, budget ?? this.model.getRemainingActionPoints(unit));
    const blocked = buildBlockedSet(this.model.getUnits(), unit.id);

    this.reachable = computeReachableTiles(unit, maxSteps, this.cfg, blocked);
    this.moveOverlay.setSelectedUnit(unit, this.reachable);

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

  tryMoveTo(dest: TileCoord): boolean {
    if (this.isAnimating) return false;

    const unit = this.getSelectedUnit();
    if (!unit) return false;

    if (!isInBoundsAndNotCutout(dest.x, dest.y, this.cfg)) return false;
    if (this.model.getUnitAtTile(dest.x, dest.y)) return false;

    // Prevent store-driven snap while we animate the move.
    this.unitRenderer.setUnitExternallyAnimating(unit.id, true);

    // Authoritative move apply lives in the model (server-friendly).
    const res = this.actions.submitLocal({ type: "move", unitId: unit.id, to: dest });
    if (!res.ok) {
      this.unitRenderer.setUnitExternallyAnimating(unit.id, false);
      return false;
    }

    const path = res.movePath ?? [];
    if (path.length < 2) return false;

    const go = this.unitRenderer.getUnitDisplayObject(unit.id);
    if (!go) return false;

    this.isAnimating = true;

    animateUnitAlongPath(this.scene, go, path, this.tileToWorld, () => {
      this.isAnimating = false;

      // Snap to exact isometric position.
      this.unitRenderer.setUnitVisualTile(unit.id, dest.x, dest.y);
      this.unitRenderer.setUnitExternallyAnimating(unit.id, false);

      // After move, refresh move range overlay based on remaining AP.
      const uNow = this.model.getUnitById(unit.id);
      if (uNow) this.setMoveRangeEnabled(this.moveRangeEnabled, this.model.getRemainingActionPoints(uNow));

      this.emit("move:complete", { unitId: unit.id });
    });

    return true;
  }

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

    // Only show preview if hover tile is in the reachable set.
    const inReach = this.reachable.some((t) => t.x === hover.x && t.y === hover.y);
    if (!inReach) {
      this.pathPreview.clear();
      return;
    }

    const budget = this.model.getRemainingActionPoints(unit);
    const blocked = buildBlockedSet(this.model.getUnits(), unit.id);
    const path = getPathForMove(unit, hover, budget, this.cfg, blocked);

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
