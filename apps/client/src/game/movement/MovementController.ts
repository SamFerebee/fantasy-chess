import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import type { TileCoord } from "./path";
import type { PathPreviewOverlay } from "./PathPreviewOverlay";
import { animateUnitAlongPath, type MoveAnimationHandle } from "./moveAnimator";
import { keyXY } from "./movementRules";
import { getPathForMove } from "./pathing";
import { ReachabilityCache } from "./ReachabilityCache";

export type TileHit = { x: number; y: number } | null;

export class MovementController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private cfg: BoardConfig;
  private units: Unit[];
  private unitRenderer: UnitRenderer;
  private moveOverlay: MoveRangeOverlay;
  private pathPreview: PathPreviewOverlay;

  private reach: ReachabilityCache;

  private animating = false;
  private moveAnim: MoveAnimationHandle | null = null;

  private msPerStep = 90;

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

    this.reach = new ReachabilityCache(this.cfg, this.units);
  }

  isAnimatingMove(): boolean {
    return this.animating;
  }

  setSelectedUnit(unit: Unit | null) {
    this.moveOverlay.setSelectedUnit(unit);
    this.pathPreview.clear();
    this.reach.setSelected(unit);
  }

  setHoverTile(tile: TileCoord | null): void {
    if (this.animating) {
      this.pathPreview.clear();
      return;
    }

    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected || !tile) {
      this.pathPreview.clear();
      return;
    }

    const reachableKeys = this.reach.ensure(selected);

    // Only show for reachable empty tiles
    if (!reachableKeys.has(keyXY(tile.x, tile.y))) {
      this.pathPreview.clear();
      return;
    }

    const occupied = this.unitRenderer.getUnitAtTile(tile.x, tile.y);
    if (occupied) {
      this.pathPreview.clear();
      return;
    }

    const path = getPathForMove({
      cfg: this.cfg,
      units: this.units,
      selected,
      dest: tile,
      reachableKeys,
    });

    if (!path || path.length < 2) {
      this.pathPreview.clear();
      return;
    }

    this.pathPreview.setPath(path);
  }

  tryMoveTo(dest: TileHit): boolean {
    if (this.animating) return true;
    if (!dest) return false;

    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected) return false;

    const occupied = this.unitRenderer.getUnitAtTile(dest.x, dest.y);
    if (occupied) return false;

    const reachableKeys = this.reach.ensure(selected);

    if (!reachableKeys.has(keyXY(dest.x, dest.y))) return false;

    const path = getPathForMove({
      cfg: this.cfg,
      units: this.units,
      selected,
      dest: { x: dest.x, y: dest.y },
      reachableKeys,
    });

    if (!path || path.length < 2) return false;

    this.pathPreview.clear();

    const obj = this.unitRenderer.getUnitDisplayObject(selected.id) as any;
    if (!obj || typeof obj.x !== "number" || typeof obj.y !== "number") {
      this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);
      this.moveOverlay.setSelectedUnit(selected);
      this.reach.recompute(selected);
      return true;
    }

    this.startMoveAnimation(selected, obj, path);
    return true;
  }

  private startMoveAnimation(selected: Unit, obj: any, path: TileCoord[]) {
    this.animating = true;

    if (this.moveAnim) {
      this.moveAnim.stop();
      this.moveAnim = null;
    }

    this.moveAnim = animateUnitAlongPath({
      scene: this.scene,
      cfg: this.cfg,
      obj,
      path,
      msPerStep: this.msPerStep,
      onDone: () => {
        const dest = path[path.length - 1];

        this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);
        this.moveOverlay.setSelectedUnit(selected);
        this.reach.recompute(selected);

        this.animating = false;
        this.moveAnim = null;
      },
    });
  }
}
