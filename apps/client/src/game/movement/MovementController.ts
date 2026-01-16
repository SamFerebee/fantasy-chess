import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { Unit } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import { computeReachableTiles } from "./reachable";
import type { TileCoord } from "./path";
import { shortestPath4, tileKey } from "./path";
import type { PathPreviewOverlay } from "./PathPreviewOverlay";

function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export type TileHit = { x: number; y: number } | null;

export class MovementController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private cfg: BoardConfig;
  private units: Unit[];
  private unitRenderer: UnitRenderer;
  private moveOverlay: MoveRangeOverlay;
  private pathPreview: PathPreviewOverlay;

  private reachableKeys: Set<string> | null = null;

  private animating = false;
  private activeTween: Phaser.Tweens.Tween | null = null;

  // tweak to taste
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
  }

  isAnimatingMove(): boolean {
    return this.animating;
  }

  setSelectedUnit(unit: Unit | null) {
    this.moveOverlay.setSelectedUnit(unit);
    this.pathPreview.clear();

    if (!unit) {
      this.reachableKeys = null;
      return;
    }

    this.reachableKeys = this.computeReachableKeySet(unit);
  }

  setHoverTile(tile: TileCoord | null): void {
    if (this.animating) {
      this.pathPreview.clear();
      return;
    }

    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected) {
      this.pathPreview.clear();
      return;
    }

    if (!tile) {
      this.pathPreview.clear();
      return;
    }

    if (!this.reachableKeys) {
      this.reachableKeys = this.computeReachableKeySet(selected);
    }

    const goalKey = tileKey(tile);
    if (!this.reachableKeys.has(goalKey)) {
      this.pathPreview.clear();
      return;
    }

    const occupied = this.unitRenderer.getUnitAtTile(tile.x, tile.y);
    if (occupied) {
      this.pathPreview.clear();
      return;
    }

    const blocked = this.buildBlockedSet(selected.id);

    const path = shortestPath4(
      { x: selected.x, y: selected.y },
      { x: tile.x, y: tile.y },
      {
        inBounds: (t) => this.isInBoundsAndNotCutout(t),
        isBlocked: (t) => blocked.has(keyXY(t.x, t.y)),
        maxSteps: selected.moveRange,
        reachableKeys: this.reachableKeys,
      }
    );

    if (!path || path.length < 2) {
      this.pathPreview.clear();
      return;
    }

    this.pathPreview.setPath(path);
  }

  tryMoveTo(dest: TileHit): boolean {
    if (this.animating) return true; // consume clicks during animation
    if (!dest) return false;

    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected) return false;

    const occupied = this.unitRenderer.getUnitAtTile(dest.x, dest.y);
    if (occupied) return false;

    if (!this.reachableKeys) {
      this.reachableKeys = this.computeReachableKeySet(selected);
    }

    const destKey = keyXY(dest.x, dest.y);
    if (!this.reachableKeys.has(destKey)) return false;

    const blocked = this.buildBlockedSet(selected.id);

    const path = shortestPath4(
      { x: selected.x, y: selected.y },
      { x: dest.x, y: dest.y },
      {
        inBounds: (t) => this.isInBoundsAndNotCutout(t),
        isBlocked: (t) => blocked.has(keyXY(t.x, t.y)),
        maxSteps: selected.moveRange,
        reachableKeys: this.reachableKeys,
      }
    );

    if (!path || path.length < 2) return false;

    this.pathPreview.clear();

    const obj = this.unitRenderer.getUnitDisplayObject(selected.id) as any;
    if (!obj || typeof obj.x !== "number" || typeof obj.y !== "number") {
      // fallback: snap move
      this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);
      this.moveOverlay.setSelectedUnit(selected);
      this.reachableKeys = this.computeReachableKeySet(selected);
      return true;
    }

    this.animateMoveAlongPath(selected, obj, path);
    return true;
  }

  private animateMoveAlongPath(selected: Unit, obj: any, path: TileCoord[]) {
    this.animating = true;

    // cancel any in-flight tween (defensive)
    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween.remove();
      this.activeTween = null;
    }

    // Ensure starting from current tile center
    const start = isoToScreen(selected.x, selected.y, this.cfg);
    obj.x = start.sx;
    obj.y = start.sy;

    const stepTo = (i: number) => {
      if (i >= path.length) {
        // done
        const dest = path[path.length - 1];

        // commit logical move at the end
        this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);

        // refresh overlay + cache from new position
        this.moveOverlay.setSelectedUnit(selected);
        this.reachableKeys = this.computeReachableKeySet(selected);

        this.animating = false;
        this.activeTween = null;
        return;
      }

      const p = isoToScreen(path[i].x, path[i].y, this.cfg);

      this.activeTween = this.scene.tweens.add({
        targets: obj,
        x: p.sx,
        y: p.sy,
        duration: this.msPerStep,
        ease: "Linear",
        onComplete: () => stepTo(i + 1),
      });
    };

    // start stepping from the second tile
    stepTo(1);
  }

  private computeReachableKeySet(selected: Unit): Set<string> {
    const blocked = this.buildBlockedSet(selected.id);

    const tiles = computeReachableTiles({
      cfg: this.cfg,
      start: { x: selected.x, y: selected.y },
      moveRange: selected.moveRange,
      blocked,
    });

    const s = new Set<string>();
    for (const t of tiles) s.add(keyXY(t.x, t.y));
    s.add(keyXY(selected.x, selected.y));
    return s;
  }

  private buildBlockedSet(selectedUnitId: string): Set<string> {
    const blocked = new Set<string>();
    for (const u of this.units) {
      if (u.id === selectedUnitId) continue;
      blocked.add(keyXY(u.x, u.y));
    }
    return blocked;
  }

  private isInBoundsAndNotCutout(t: TileCoord): boolean {
    const { cols, rows, cornerCut } = this.cfg;

    if (t.x < 0 || t.y < 0 || t.x >= cols || t.y >= rows) return false;
    if (cornerCut <= 0) return true;

    if (t.x < cornerCut && t.y < cornerCut) return false;
    if (t.x >= cols - cornerCut && t.y < cornerCut) return false;
    if (t.x < cornerCut && t.y >= rows - cornerCut) return false;
    if (t.x >= cols - cornerCut && t.y >= rows - cornerCut) return false;

    return true;
  }
}
