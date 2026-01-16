import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { TileCoord } from "./path";

export type MoveAnimationHandle = {
  stop: () => void;
};

export function animateUnitAlongPath(args: {
  scene: Phaser.Scene;
  cfg: BoardConfig;
  obj: any; // Phaser GameObject with x/y
  path: TileCoord[];
  msPerStep: number;
  onDone: () => void;
}): MoveAnimationHandle {
  let activeTween: Phaser.Tweens.Tween | null = null;
  let stopped = false;

  const stop = () => {
    stopped = true;
    if (activeTween) {
      activeTween.stop();
      activeTween.remove();
      activeTween = null;
    }
  };

  if (!args.path || args.path.length < 2) {
    args.onDone();
    return { stop };
  }

  const start = args.path[0];
  const startPos = isoToScreen(start.x, start.y, args.cfg);
  args.obj.x = startPos.sx;
  args.obj.y = startPos.sy;

  const stepTo = (i: number) => {
    if (stopped) return;

    if (i >= args.path.length) {
      args.onDone();
      return;
    }

    const p = isoToScreen(args.path[i].x, args.path[i].y, args.cfg);

    activeTween = args.scene.tweens.add({
      targets: args.obj,
      x: p.sx,
      y: p.sy,
      duration: args.msPerStep,
      ease: "Linear",
      onComplete: () => stepTo(i + 1),
    });
  };

  stepTo(1);

  return { stop };
}
