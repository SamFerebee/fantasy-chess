import Phaser from "phaser";
import type { Team } from "../units/UnitTypes";

export class TurnHud {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private text: Phaser.GameObjects.Text;

  constructor(args: { scene: Phaser.Scene; cam: Phaser.Cameras.Scene2D.Camera }) {
    this.cam = args.cam;

    this.text = args.scene.add
      .text(0, 0, "", {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "18px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: { left: 10, right: 10, top: 6, bottom: 6 },
      })
      .setDepth(1000);
  }

  setTurnInfo(team: Team, extraLine: string) {
    this.text.setText(`Turn: Team ${team}${extraLine}`);
  }

  updatePosition() {
    const topLeft = this.cam.getWorldPoint(0, 0);
    const invZoom = 1 / this.cam.zoom;

    this.text.setScale(invZoom);
    this.text.setPosition(topLeft.x + 12 * invZoom, topLeft.y + 12 * invZoom);
  }
}
