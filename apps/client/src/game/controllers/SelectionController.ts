import Phaser from "phaser";
import type { TilePicker } from "../input/TilePicker";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { TurnController } from "./TurnController";

export class SelectionController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private picker: TilePicker;
  private overlay: TileOverlay;
  private unitRenderer: UnitRenderer;
  private movement: MovementController;
  private turns: TurnController;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    picker: TilePicker;
    overlay: TileOverlay;
    unitRenderer: UnitRenderer;
    movement: MovementController;
    turns: TurnController;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.picker = args.picker;
    this.overlay = args.overlay;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
    this.turns = args.turns;
  }

  attach() {
    // Hover: keep hover highlight + update path preview
    this.picker.onHover((hit) => {
      this.overlay.setHovered(hit);

      // Only preview when a controllable unit is selected
      const selected = this.unitRenderer.getSelectedUnit();
      if (!selected || !this.turns.canControlUnit(selected)) {
        this.movement.setHoverTile(null);
        return;
      }

      this.movement.setHoverTile(hit);
    });

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (this.movement.isAnimatingMove()) return;

      const world = this.cam.getWorldPoint(pointer.x, pointer.y);

      // 1) Direct hit on unit shape -> select unit only (if controllable)
      const hitUnit = this.unitRenderer.pickUnitAtWorldPoint(world.x, world.y);
      if (hitUnit) {
        if (!this.turns.canControlUnit(hitUnit)) return;

        this.unitRenderer.setSelectedUnitId(hitUnit.id);
        this.overlay.setSelected(null); // unit-only highlight
        this.movement.setSelectedUnit(hitUnit);
        console.log("Selected unit:", hitUnit.id, "at", hitUnit.x, hitUnit.y);
        return;
      }

      // 2) Tile hit
      const hitTile = this.picker.getTileAtPointer(pointer);

      // 2a) If a unit is selected AND it's controllable, try moving
      const selected = this.unitRenderer.getSelectedUnit();
      if (selected && this.turns.canControlUnit(selected)) {
        if (this.movement.tryMoveTo(hitTile)) {
          this.overlay.setSelected(null);
          this.movement.setHoverTile(null);
          return;
        }
      }

      // 3) If tile contains a unit, select it only if controllable
      if (hitTile) {
        const unitOnTile = this.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
        if (unitOnTile) {
          if (!this.turns.canControlUnit(unitOnTile)) return;

          this.unitRenderer.setSelectedUnitId(unitOnTile.id);
          this.overlay.setSelected(null);
          this.movement.setSelectedUnit(unitOnTile);
          console.log("Selected unit:", unitOnTile.id, "at", unitOnTile.x, unitOnTile.y);
          return;
        }
      }

      // 4) Otherwise select tile and clear unit selection / move overlay
      this.unitRenderer.setSelectedUnitId(null);
      this.overlay.setSelected(hitTile);
      this.movement.setSelectedUnit(null);
      this.movement.setHoverTile(null);

      if (hitTile) console.log("Selected tile:", hitTile.x, hitTile.y);
    });
  }
}
