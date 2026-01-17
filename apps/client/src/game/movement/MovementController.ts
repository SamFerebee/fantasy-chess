import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import type { PathPreviewOverlay } from "./PathPreviewOverlay";
import type { TileCoord } from "./path";

import { ReachabilityCache } from "./ReachabilityCache";
import { buildBlockedSet, computeReachableTiles, isInBoundsAndNotCutout, keyXY } from "./movementRules";
import { getPathForMove } from "./pathing";
import { animateUnitAlongPath } from "./moveAnimator";

export type MoveResult = { ok: false } | { ok: true; cost: number };

export class MovementController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private cfg: BoardConfig;
  private units: Unit[];
  private unitRenderer: UnitRenderer;
  private moveOverlay: MoveRangeOverlay;
  private pathPreview: PathPreviewOverlay;

  private selectedUnit: Unit | null = null;
  private hoverTile: TileCoord | null = null;

  private animating = false;

  private reach = new ReachabilityCache();

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    cfg: BoardConfig;
    units: Unit[];
    unitRenderer: UnitRenderer;
    moveOverlay: MoveRangeOverlay;
    pathPreview: PathPreviewOverlay;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.cfg = args.cfg;
    this.units = args.units;
    this.unitRenderer = args.unitRenderer;
    this.moveOverlay = args.moveOverlay;
    this.pathPreview = args.pathPreview;
  }

  isAnimatingMove() {
    return this.animating;
  }

  setMoveRangeEnabled(enabled: boolean, budget?: number) {
    if (!enabled || !this.selectedUnit) {
      this.pathPreview.setPath([]);
      this.moveOverlay.setSelectedUnit(null, []);
      return;
    }

    const maxSteps = Math.max(0, budget ?? this.selectedUnit.actionPoints);
    const blocked = buildBlockedSet(this.units, this.selectedUnit.id);
    const reachable = computeReachableTiles(this.selectedUnit, maxSteps, this.cfg, blocked);

    this.reach.set(this.selectedUnit.id, maxSteps, reachable.map((t) => keyXY(t.x, t.y)));
    this.moveOverlay.setSelectedUnit(this.selectedUnit, reachable);
  }

  setSelectedUnit(unit: Unit | null, budget?: number) {
    this.selectedUnit = unit;
    this.hoverTile = null;
    this.pathPreview.setPath([]);

    if (!unit) {
      this.reach.clear();
      this.moveOverlay.setSelectedUnit(null, []);
      return;
    }

    this.setMoveRangeEnabled(true, budget);
  }

  setHoverTile(tile: TileCoord | null) {
    this.hoverTile = tile;

    if (this.animating || !this.selectedUnit || !tile) {
      this.pathPreview.setPath([]);
      return;
    }

    const maxSteps = this.reach.getBudgetForSelected(this.selectedUnit.id);
    const reachableKeys = this.reach.getKeysForSelected(this.selectedUnit.id);
    if (!reachableKeys) {
      this.pathPreview.setPath([]);
      return;
    }

    const destKey = keyXY(tile.x, tile.y);
    if (!reachableKeys.has(destKey)) {
      this.pathPreview.setPath([]);
      return;
    }

    const occupied = this.units.some((u) => u.id !== this.selectedUnit!.id && u.x === tile.x && u.y === tile.y);
    if (occupied) {
      this.pathPreview.setPath([]);
      return;
    }

    const blocked = buildBlockedSet(this.units, this.selectedUnit.id);
    const path = getPathForMove(this.selectedUnit, tile, maxSteps, this.cfg, blocked);

    this.pathPreview.setPath(path);
  }

  tryMoveTo(tile: TileCoord | null, budget: number): MoveResult {
    if (this.animating) return { ok: false };
    if (!this.selectedUnit) return { ok: false };
    if (!tile) return { ok: false };

    const movingUnitId = this.selectedUnit.id;
    const maxSteps = Math.max(0, budget);

    if (!isInBoundsAndNotCutout(tile.x, tile.y, this.cfg)) return { ok: false };

    const occupied = this.units.some((u) => u.id !== movingUnitId && u.x === tile.x && u.y === tile.y);
    if (occupied) return { ok: false };

    const blocked = buildBlockedSet(this.units, movingUnitId);
    const path = getPathForMove(this.selectedUnit, tile, maxSteps, this.cfg, blocked);
    if (path.length === 0) return { ok: false };

    const cost = Math.max(0, path.length - 1);
    if (cost <= 0) return { ok: false };
    if (cost > maxSteps) return { ok: false };

    this.pathPreview.setPath([]);

    const go = this.unitRenderer.getUnitDisplayObject(movingUnitId);
    if (!go) return { ok: false };

    this.animating = true;

    const destX = tile.x;
    const destY = tile.y;

    const tileToWorld = (t: TileCoord) => ({
      x: (t.x - t.y) * (this.cfg.tileW / 2),
      y: (t.x + t.y) * (this.cfg.tileH / 2),
    });

    animateUnitAlongPath(this.scene, go, path, tileToWorld, () => {
      this.animating = false;

      this.unitRenderer.moveUnitTo(movingUnitId, destX, destY);

      const current = this.unitRenderer.getSelectedUnit();
      if (current && current.id === movingUnitId) {
        this.setMoveRangeEnabled(true, Math.max(0, maxSteps - cost));
      } else {
        this.pathPreview.setPath([]);
      }

      // Notify TurnController (auto end turn after move, if needed)
      this.scene.events.emit("move:complete", { unitId: movingUnitId });
    });

    return { ok: true, cost };
  }
}
