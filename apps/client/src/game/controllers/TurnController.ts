import Phaser from "phaser";
import type { Team, Unit } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { TileOverlay } from "../board/TileOverlay";
import type { MovementController } from "../movement/MovementController";

export class TurnController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private unitRenderer: UnitRenderer;
  private overlay: TileOverlay;
  private movement: MovementController;

  private activeTeam: Team = "A";
  private hudText: Phaser.GameObjects.Text;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    unitRenderer: UnitRenderer;
    overlay: TileOverlay;
    movement: MovementController;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.unitRenderer = args.unitRenderer;
    this.overlay = args.overlay;
    this.movement = args.movement;

    this.hudText = this.scene.add
      .text(0, 0, "", {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: "18px",
        color: "#ffffff",
      })
      .setOrigin(0, 0)
      .setDepth(10000)
      .setPadding(8, 6, 8, 6)
      .setBackgroundColor("rgba(0,0,0,0.55)");

    this.updateHud();
    this.refreshHudTransform();

    // Keep HUD pinned to the top-left of the *screen* even as camera zoom/scroll changes
    this.scene.events.on("postupdate", this.refreshHudTransform, this);

    const kb = this.scene.input.keyboard;
    if (kb) kb.on("keydown-E", () => this.endTurn());
  }

  getActiveTeam(): Team {
    return this.activeTeam;
  }

  canControlUnit(unit: Unit): boolean {
    return unit.team === this.activeTeam;
  }

  endTurn(): void {
    this.activeTeam = this.activeTeam === "A" ? "B" : "A";
    this.updateHud();

    this.unitRenderer.setSelectedUnitId(null);
    this.overlay.setSelected(null);
    this.movement.setSelectedUnit(null);
    this.movement.setHoverTile(null);
  }

  private updateHud(): void {
    this.hudText.setText(`Turn: Team ${this.activeTeam} (press E)`);
  }

  private refreshHudTransform(): void {
    const padX = 12;
    const padY = 12;
    const z = this.cam.zoom || 1;

    // World-space coordinate of the screen's top-left corner.
    const tl = this.cam.getWorldPoint(0, 0);

    // Place and scale so it renders in screen pixels (independent of zoom).
    this.hudText.x = tl.x + padX / z;
    this.hudText.y = tl.y + padY / z;
    this.hudText.setScale(1 / z);
  }
}
