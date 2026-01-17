import Phaser from "phaser";
import type { TileCoord } from "./path";

export function animateUnitAlongPath(
  scene: Phaser.Scene,
  go: Phaser.GameObjects.GameObject,
  path: TileCoord[],
  tileToWorld: (t: TileCoord) => { x: number; y: number },
  onComplete: () => void
) {
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
