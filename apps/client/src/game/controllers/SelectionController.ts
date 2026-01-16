import Phaser from "phaser";
import type { TilePicker } from "../input/TilePicker";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";

export class SelectionController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private picker: TilePicker;
  private overlay: TileOverlay;
  private unitRenderer: UnitRenderer;
  private movement: MovementController;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    picker: TilePicker;
    overlay: TileOverlay;
    unitRenderer: UnitRenderer;
    movement: MovementController;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.picker = args.picker;
    this.overlay = args.overlay;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
  }

  attach() {
    // Hover (unchanged)
    this.picker.onHover((hit) => this.overlay.setHovered(hit));

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const world = this.cam.getWorldPoint(pointer.x, pointer.y);

      // 1) Direct hit on unit shape -> select unit only
      const hitUnit = this.unitRenderer.pickUnitAtWorldPoint(world.x, world.y);
      if (hitUnit) {
        this.unitRenderer.setSelectedUnitId(hitUnit.id);
        this.overlay.setSelected(null); // unit-only highlight
        this.movement.setSelectedUnit(hitUnit);
        console.log("Selected unit:", hitUnit.id, "at", hitUnit.x, hitUnit.y);
        return;
      }

      // 2) Tile hit
      const hitTile = this.picker.getTileAtPointer(pointer);

      // 2a) If a unit is already selected, try moving to clicked tile
      // (consumes the click if a move happens)
      if (this.movement.tryMoveTo(hitTile)) {
        // Keep unit-only highlight rule
        this.overlay.setSelected(null);
        return;
      }

      // 3) If tile contains a unit, select unit only (even if click was "on tile")
      if (hitTile) {
        const unitOnTile = this.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
        if (unitOnTile) {
          this.unitRenderer.setSelectedUnitId(unitOnTile.id);
          this.overlay.setSelected(null); // unit-only highlight
          this.movement.setSelectedUnit(unitOnTile);
          console.log("Selected unit:", unitOnTile.id, "at", unitOnTile.x, unitOnTile.y);
          return;
        }
      }

      // 4) Otherwise select tile and clear unit selection / move overlay
      this.unitRenderer.setSelectedUnitId(null);
      this.overlay.setSelected(hitTile);
      this.movement.setSelectedUnit(null);

      if (hitTile) console.log("Selected tile:", hitTile.x, hitTile.y);
    });
  }
}
