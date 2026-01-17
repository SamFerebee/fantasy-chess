import Phaser from "phaser";
import type { ActionMode } from "../input/ActionMode";

type Button = {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  kind: "move" | "attack" | "endTurn";
};

export class ActionBar {
  private cam: Phaser.Cameras.Scene2D.Camera;
  private root: Phaser.GameObjects.Container;

  private buttons: Button[] = [];
  private mode: ActionMode = "move";

  private onEndTurn: () => void;
  private modeListeners: Array<(mode: ActionMode) => void> = [];

  constructor(args: { scene: Phaser.Scene; cam: Phaser.Cameras.Scene2D.Camera; onEndTurn: () => void }) {
    this.cam = args.cam;
    this.onEndTurn = args.onEndTurn;

    this.root = args.scene.add.container(0, 0).setDepth(1000);

    const makeBtn = (kind: Button["kind"], text: string) => {
      const bg = args.scene.add
        .rectangle(0, 0, 92, 30, 0x000000, 0.55)
        .setStrokeStyle(1, 0xffffff, 0.35)
        .setInteractive({ useHandCursor: true });

      const label = args.scene.add.text(0, 0, text, {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "14px",
        color: "#ffffff",
      });
      label.setOrigin(0.5, 0.5);

      bg.on(
        "pointerdown",
        (
          _pointer: Phaser.Input.Pointer,
          _localX: number,
          _localY: number,
          event: Phaser.Types.Input.EventData
        ) => {
          event.stopPropagation();

          if (kind === "endTurn") {
            this.onEndTurn();
            return;
          }
          this.setMode(kind);
        }
      );

      this.root.add(bg);
      this.root.add(label);

      this.buttons.push({ kind, bg, label });
    };

    makeBtn("move", "Move");
    makeBtn("attack", "Attack");
    makeBtn("endTurn", "End Turn");

    this.layout();
    this.applyVisualState();
    this.updatePosition();
  }

  onModeChanged(cb: (mode: ActionMode) => void) {
    this.modeListeners.push(cb);
  }

  getMode(): ActionMode {
    return this.mode;
  }

  setMode(mode: ActionMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyVisualState();
    for (const cb of this.modeListeners) cb(this.mode);
  }

  updatePosition() {
    const topLeft = this.cam.getWorldPoint(0, 0);
    const invZoom = 1 / this.cam.zoom;

    this.root.setScale(invZoom);

    const padX = 12 * invZoom;
    const padY = 12 * invZoom;

    const totalW = this.getWidth() * invZoom;
    const x = topLeft.x + this.cam.width * invZoom - totalW - padX;
    const y = topLeft.y + padY;

    this.root.setPosition(x, y);
  }

  private layout() {
    const gap = 10;
    let x = 0;
    const y = 0;

    for (const b of this.buttons) {
      b.bg.setPosition(x + b.bg.width / 2, y + b.bg.height / 2);
      b.label.setPosition(x + b.bg.width / 2, y + b.bg.height / 2);
      x += b.bg.width + gap;
    }
  }

  private getWidth(): number {
    if (this.buttons.length === 0) return 0;
    const gap = 10;
    const btnW = this.buttons[0].bg.width;
    return this.buttons.length * btnW + (this.buttons.length - 1) * gap;
  }

  private applyVisualState() {
    for (const b of this.buttons) {
      const isModeBtn = b.kind === "move" || b.kind === "attack";
      const selected = isModeBtn && b.kind === this.mode;

      if (selected) {
        b.bg.setFillStyle(0xffffff, 0.18);
        b.bg.setStrokeStyle(2, 0xffffff, 0.9);
      } else {
        b.bg.setFillStyle(0x000000, 0.55);
        b.bg.setStrokeStyle(1, 0xffffff, 0.35);
      }
    }
  }
}
