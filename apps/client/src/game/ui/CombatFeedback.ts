import Phaser from "phaser";
import type { UnitRenderer } from "../units/UnitRenderer";

/**
 * Visual-only combat feedback.
 * - Hit flash (alpha pulse)
 * - Floating damage numbers
 * - Optional death fade
 *
 * No gameplay logic. Safe for server-authoritative setups.
 */
export class CombatFeedback {
  private scene: Phaser.Scene;
  private unitRenderer: UnitRenderer;

  constructor(args: { scene: Phaser.Scene; unitRenderer: UnitRenderer }) {
    this.scene = args.scene;
    this.unitRenderer = args.unitRenderer;
  }

  /**
   * Shows a hit flash and floating damage number above the target.
   * If the unit is not currently rendered (no display object), this is a no-op.
   */
  playHit(targetUnitId: string, amount: number) {
    const go = this.unitRenderer.getUnitDisplayObject(targetUnitId) as Phaser.GameObjects.GameObject | null;
    if (!go) return;

    const x = (go as any).x as number;
    const y = (go as any).y as number;

    // Flash: quick alpha pulse.
    this.scene.tweens.add({
      targets: go,
      alpha: 0.25,
      duration: 70,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        // Ensure we return to fully visible even if overlapping tweens occurred.
        (go as any).alpha = 1;
      },
    });

    // Floating damage text.
    const label = this.scene.add
      .text(x, y - 22, `-${Math.max(0, Math.floor(amount))}`, {
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        fontSize: "16px",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1)
      .setDepth(50);

    this.scene.tweens.add({
      targets: label,
      y: label.y - 18,
      alpha: 0,
      duration: 650,
      ease: "Cubic.Out",
      onComplete: () => label.destroy(),
    });
  }

  /**
   * Plays a short fade/shrink animation, then runs `onComplete`.
   * If the unit is not currently rendered, calls `onComplete` immediately.
   */
  playDeath(unitId: string, onComplete: () => void) {
    const go = this.unitRenderer.getUnitDisplayObject(unitId) as Phaser.GameObjects.GameObject | null;
    if (!go) {
      onComplete();
      return;
    }

    this.scene.tweens.add({
      targets: go,
      alpha: 0,
      scaleX: (go as any).scaleX * 0.75,
      scaleY: (go as any).scaleY * 0.75,
      duration: 220,
      ease: "Cubic.In",
      onComplete: () => onComplete(),
    });
  }
}
