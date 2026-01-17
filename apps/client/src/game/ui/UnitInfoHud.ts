import Phaser from "phaser";
import type { Unit } from "../units/UnitTypes";

type HudAnchor = "left" | "right";

export class UnitInfoHud {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private text: Phaser.GameObjects.Text;

  private lastRendered: string = "";
  private yOffsetWorld: number;
  private anchor: HudAnchor;
  private xPaddingWorld: number;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    yOffsetWorld?: number;
    anchor?: HudAnchor;
    xPaddingWorld?: number;
  }) {
    this.cam = args.cam;
    this.yOffsetWorld = args.yOffsetWorld ?? 54;
    this.anchor = args.anchor ?? "left";
    this.xPaddingWorld = args.xPaddingWorld ?? 12;

    this.text = args.scene.add
      .text(0, 0, "", {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "rgba(0,0,0,0.55)",
        padding: { left: 10, right: 10, top: 8, bottom: 8 },
      })
      .setDepth(1000);

    this.text.setOrigin(this.anchor === "right" ? 1 : 0, 0);
    this.setUnit(null);
  }

  /**
   * @param currentActionPoints Remaining AP for the unit.
   *                           If omitted, shows unit.actionPoints (max).
   */
  setUnit(unit: Unit | null, currentActionPoints?: number) {
    const next = unit
      ? [
          `Unit: ${unit.name}`,
          `HP: ${unit.hp}/${unit.maxHP}`,
          `Action Points: ${(currentActionPoints ?? unit.actionPoints)}/${unit.actionPoints}`,
          `Damage: ${unit.damage}`,
          `Armor: ${unit.armor}`,
        ].join("\n")
      : "";

    if (next === this.lastRendered) return;

    this.lastRendered = next;
    this.text.setText(next);
    this.text.setVisible(next.length > 0);
  }

  updatePosition() {
    if (!this.text.visible) return;

    const topLeft = this.cam.getWorldPoint(0, 0);
    const topRight = this.cam.getWorldPoint(this.cam.width, 0);
    const invZoom = 1 / this.cam.zoom;

    this.text.setScale(invZoom);

    const x =
      this.anchor === "right"
        ? topRight.x - this.xPaddingWorld * invZoom
        : topLeft.x + this.xPaddingWorld * invZoom;

    const y = topLeft.y + this.yOffsetWorld * invZoom;

    this.text.setPosition(x, y);
  }
}
