import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { screenToIso } from "../board/iso";

export type TileHit = { x: number; y: number } | null;

export class TilePicker {
  private scene: Phaser.Scene;
  private cfg: BoardConfig;
  private cam: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene, cfg: BoardConfig, cam: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.cfg = cfg;
    this.cam = cam;
  }

  getTileAtPointer(pointer: Phaser.Input.Pointer): TileHit {
    const world = this.cam.getWorldPoint(pointer.x, pointer.y);
    return screenToIso(world.x, world.y, this.cfg);
  }

  onHover(cb: (hit: TileHit) => void) {
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const evt = pointer.event as any;
      const pt = (pointer as any).pointerType ?? evt?.pointerType;

      const isTouch = pointer.wasTouch === true || pt === "touch";

      // Only suppress hover during drag for touch (mobile)
      if (isTouch && pointer.isDown) return;

      cb(this.getTileAtPointer(pointer));
    });
  }

  onSelect(cb: (hit: TileHit) => void) {
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => cb(this.getTileAtPointer(pointer)));
  }
}
