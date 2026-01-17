import Phaser from "phaser";
import type { Tile } from "./MovementController";

export function animateUnitAlongPath(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.GameObject,
  path: Tile[],
  tileToWorld: (t: Tile) => { x: number; y: number },
  onComplete: () => void
) {
  // path includes start tile; we animate through subsequent tiles
  const steps = path.slice(1);
  if (steps.length === 0) {
    onComplete();
    return;
  }

  const durationPerStepMs = 90;

  const stepTween = (i: number) => {
    if (i >= steps.length) {
      onComplete();
      return;
    }

    const p = tileToWorld(steps[i]);
    scene.tweens.add({
      targets: go as any,
      x: p.x,
      y: p.y,
      duration: durationPerStepMs,
      onComplete: () => stepTween(i + 1),
    });
  };

  stepTween(0);
}
