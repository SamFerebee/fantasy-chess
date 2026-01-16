// apps/client/src/movement/MovementController.ts
import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
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

  // Cached reachability for the currently selected unit
  private reachableKeys: Set<string> | null = null;

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

  setSelectedUnit(unit: Unit | null) {
    this.moveOverlay.setSelectedUnit(unit);
    this.pathPreview.clear();

    if (!unit) {
      this.reachableKeys = null;
      return;
    }

    this.reachableKeys = this.computeReachableKeySet(unit);
  }

  /**
   * Call this on tile hover changes (or null when leaving board).
   * Shows shortest path from selected unit to hovered reachable tile.
   */
  setHoverTile(tile: TileCoord | null): void {
    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected) {
      this.pathPreview.clear();
      return;
    }

    if (!tile) {
      this.pathPreview.clear();
      return;
    }

    // Ensure reachability cache exists
    if (!this.reachableKeys) {
      this.reachableKeys = this.computeReachableKeySet(selected);
    }

    // Only show for reachable empty tiles
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

  /**
   * Attempt to move the currently selected unit to `dest`.
   * Returns true if a move happened (and the click was consumed).
   */
  tryMoveTo(dest: TileHit): boolean {
    if (!dest) return false;

    const selected = this.unitRenderer.getSelectedUnit();
    if (!selected) return false;

    // Can't move onto occupied tile
    const occupied = this.unitRenderer.getUnitAtTile(dest.x, dest.y);
    if (occupied) return false;

    // Ensure reachability cache exists and is current
    if (!this.reachableKeys) {
      this.reachableKeys = this.computeReachableKeySet(selected);
    }

    const destKey = keyXY(dest.x, dest.y);
    if (!this.reachableKeys.has(destKey)) return false;

    // Apply move
    this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);

    // Refresh overlay from new position
    this.moveOverlay.setSelectedUnit(selected);

    // Clear preview and recompute reachability from new location
    this.pathPreview.clear();
    this.reachableKeys = this.computeReachableKeySet(selected);

    console.log("Moved unit:", selected.id, "to", dest.x, dest.y);
    return true;
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

    // Remove cornerCut x cornerCut squares at each corner
    // TL: x < cut && y < cut
    if (t.x < cornerCut && t.y < cornerCut) return false;
    // TR: x >= cols - cut && y < cut
    if (t.x >= cols - cornerCut && t.y < cornerCut) return false;
    // BL: x < cut && y >= rows - cut
    if (t.x < cornerCut && t.y >= rows - cornerCut) return false;
    // BR: x >= cols - cut && y >= rows - cut
    if (t.x >= cols - cornerCut && t.y >= rows - cornerCut) return false;

    return true;
  }
}
