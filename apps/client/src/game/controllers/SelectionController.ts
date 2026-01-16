import Phaser from "phaser";
import type { TilePicker } from "../input/TilePicker";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MoveRangeOverlay } from "../movement/MoveRangeOverlay";
import { computeReachableTiles } from "../movement/reachable";
import { BOARD } from "../board/BoardConfig";

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

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const world = this.cam.getWorldPoint(pointer.x, pointer.y);

      // 1) Direct hit on unit shape -> select unit only
      const hitUnit = this.unitRenderer.pickUnitAtWorldPoint(world.x, world.y);
      if (hitUnit) {
        this.unitRenderer.setSelectedUnitId(hitUnit.id);
        this.overlay.setSelected(null); // unit-only highlight
        this.moveOverlay.setSelectedUnit(hitUnit);
        console.log("Selected unit:", hitUnit.id, "at", hitUnit.x, hitUnit.y);
        return;
      }

      // 2) Tile hit
      const hitTile = this.picker.getTileAtPointer(pointer);

      // 2a) If a unit is already selected and we clicked an empty reachable tile -> move
      const selected = this.unitRenderer.getSelectedUnit();
      if (selected && hitTile) {
        const destOccupied = this.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
        if (!destOccupied) {
          const tiles = computeReachableTiles({
            cfg: BOARD,
            start: { x: selected.x, y: selected.y },
            moveRange: selected.moveRange,
            blocked: new Set<string>(),
          });

          const reachable = tiles.some((t) => t.x === hitTile.x && t.y === hitTile.y);
          if (reachable) {
            this.unitRenderer.moveUnitTo(selected.id, hitTile.x, hitTile.y);

            // keep unit selected; highlight only unit; refresh overlay from new position
            this.overlay.setSelected(null);
            this.moveOverlay.setSelectedUnit(selected);

            console.log("Moved unit:", selected.id, "to", hitTile.x, hitTile.y);
            return;
          }
        }
      }

      // 3) If tile contains a unit, select unit only
      if (hitTile) {
        const unitOnTile = this.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
        if (unitOnTile) {
          this.unitRenderer.setSelectedUnitId(unitOnTile.id);
          this.overlay.setSelected(null); // unit-only highlight
          this.moveOverlay.setSelectedUnit(unitOnTile);
          console.log("Selected unit:", unitOnTile.id, "at", unitOnTile.x, unitOnTile.y);
          return;
        }
      }

      // 4) Otherwise select tile and clear unit selection / move overlay
      this.unitRenderer.setSelectedUnitId(null);
      this.overlay.setSelected(hitTile);
      this.moveOverlay.setSelectedUnit(null);

      if (hitTile) console.log("Selected tile:", hitTile.x, hitTile.y);
    });
  }
}
