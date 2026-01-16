import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "./MoveRangeOverlay";
import { computeReachableTiles } from "./reachable";

function key(x: number, y: number) {
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

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    cfg: BoardConfig;
    units: Unit[];
    unitRenderer: UnitRenderer;
    moveOverlay: MoveRangeOverlay;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.cfg = args.cfg;
    this.units = args.units;
    this.unitRenderer = args.unitRenderer;
    this.moveOverlay = args.moveOverlay;
  }

  setSelectedUnit(unit: Unit | null) {
    this.moveOverlay.setSelectedUnit(unit);
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

    // Build blocked set so reachability doesn't flood through other units
    const blocked = new Set<string>();
    for (const u of this.units) {
      if (u.id === selected.id) continue;
      blocked.add(key(u.x, u.y));
    }

    const reachable = computeReachableTiles({
      cfg: this.cfg,
      start: { x: selected.x, y: selected.y },
      moveRange: selected.moveRange,
      blocked,
    }).some((t) => t.x === dest.x && t.y === dest.y);

    if (!reachable) return false;

    // Apply move
    this.unitRenderer.moveUnitTo(selected.id, dest.x, dest.y);

    // Refresh overlay from new position (selected object has updated coords because units array is shared)
    this.moveOverlay.setSelectedUnit(selected);

    console.log("Moved unit:", selected.id, "to", dest.x, dest.y);
    return true;
  }
}