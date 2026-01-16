import Phaser from "phaser";
import type { TilePicker } from "../input/TilePicker";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "../movement/MoveRangeOverlay";
import type { Unit } from "../units/UnitTypes";


export class SelectionController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private picker: TilePicker;
  private overlay: TileOverlay;
  private unitRenderer: UnitRenderer;
  private moveOverlay: MoveRangeOverlay;


  constructor(
    scene: Phaser.Scene,
    cam: Phaser.Cameras.Scene2D.Camera,
    picker: TilePicker,
    overlay: TileOverlay,
    unitRenderer: UnitRenderer,
    moveOverlay: MoveRangeOverlay
  ) {
    this.scene = scene;
    this.cam = cam;
    this.picker = picker;
    this.overlay = overlay;
    this.unitRenderer = unitRenderer;
    this.moveOverlay = moveOverlay;
  }

  attach() {
    // Hover (unchanged)
    this.picker.onHover((hit) => this.overlay.setHovered(hit));

    // Selection (unit first, then tile, then unit-on-tile)
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const world = this.cam.getWorldPoint(pointer.x, pointer.y);

    // 1) Direct hit on unit shape
    const hitUnit = this.unitRenderer.pickUnitAtWorldPoint(world.x, world.y);
    if (hitUnit) {
        this.unitRenderer.setSelectedUnitId(hitUnit.id);

        // Only highlight the unit (no tile highlight)
        this.overlay.setSelected(null);
        this.moveOverlay.setSelectedUnit(hitUnit);
        console.log("Selected unit:", hitUnit.id, "at", hitUnit.x, hitUnit.y);
        return;
    }

    // 2) Tile hit
    const hitTile = this.picker.getTileAtPointer(pointer);

    // 3) If tile contains a unit, select unit only
    if (hitTile) {
        const unitOnTile = this.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
        if (unitOnTile) {
        this.unitRenderer.setSelectedUnitId(unitOnTile.id);

        // Only highlight the unit (no tile highlight)
        this.overlay.setSelected(null);
        this.moveOverlay.setSelectedUnit(unitOnTile);
        console.log("Selected unit:", unitOnTile.id, "at", unitOnTile.x, unitOnTile.y);
        return;
        }
    }

    // 4) Otherwise select tile and clear unit selection
    this.unitRenderer.setSelectedUnitId(null);
    this.overlay.setSelected(hitTile);
    this.moveOverlay.setSelectedUnit(null);

    });
  }
}
