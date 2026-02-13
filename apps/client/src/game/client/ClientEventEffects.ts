import Phaser from "phaser";
import type { GameEvent } from "../sim/GameEvents";
import type { RenderStateStore } from "../render/RenderStateStore";
import type { UnitRenderer } from "../units/UnitRenderer";
import { CombatFeedback } from "../ui/CombatFeedback";

/**
 * Client-side visual effects driven strictly from sim events.
 *
 * This keeps controllers free of render-store mutations and ensures all
 * state changes flow through ActionQueue -> events.
 */
export class ClientEventEffects {
  private scene: Phaser.Scene;
  private unitRenderer: UnitRenderer;
  private renderStore: RenderStateStore;
  private feedback: CombatFeedback;

  constructor(args: { scene: Phaser.Scene; unitRenderer: UnitRenderer; renderStore: RenderStateStore }) {
    this.scene = args.scene;
    this.unitRenderer = args.unitRenderer;
    this.renderStore = args.renderStore;
    this.feedback = new CombatFeedback({ scene: this.scene, unitRenderer: this.unitRenderer });
  }

  applyEvents(events: GameEvent[]) {
    const damagedTargets = new Set<string>();

    // -----------------------------------------------------------------------
    // Attack + hit/block animations (best-effort, driven only from events)
    // -----------------------------------------------------------------------
    for (const ev of events) {
      if (ev.type === "unitDamaged") {
        const attacker = this.renderStore.getUnit(ev.attackerId);
        const target = this.renderStore.getUnit(ev.targetId);

        if (attacker && target) {
          // Attacker faces the target for the attack.
          this.unitRenderer.playAttack(attacker.id, { x: attacker.x, y: attacker.y }, { x: target.x, y: target.y });

          // Target faces attacker for reaction.
          if (ev.amount <= 0) {
            this.unitRenderer.playBlock(target.id, { x: target.x, y: target.y }, { x: attacker.x, y: attacker.y });
          } else {
            this.unitRenderer.playHit(target.id, { x: target.x, y: target.y }, { x: attacker.x, y: attacker.y });
          }
        }
      }

      if (ev.type === "attackMissed") {
        const attacker = this.renderStore.getUnit(ev.attackerId);
        if (attacker) {
          this.unitRenderer.playAttack(attacker.id, { x: attacker.x, y: attacker.y }, ev.target);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Primary hit feedback (damage numbers)
    // -----------------------------------------------------------------------
    for (const ev of events) {
      if (ev.type === "unitDamaged") {
        damagedTargets.add(ev.targetId);
        this.feedback.playHit(ev.targetId, ev.amount);
      }
    }

    // If HP changed but we didn't emit unitDamaged (e.g. 0 damage), still flash.
    for (const ev of events) {
      if (ev.type === "unitHpChanged") {
        if (!damagedTargets.has(ev.unitId)) {
          this.feedback.playHit(ev.unitId, 0);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Death animation + finalize removal from render store.
    // -----------------------------------------------------------------------
    for (const ev of events) {
      if (ev.type !== "unitRemoved") continue;

      this.unitRenderer.setUnitExternallyAnimating(ev.unitId, true);

      // Try to show a death pose/anim before the fade-out feedback.
      this.unitRenderer.playDeath(ev.unitId);

      // After the death pose shows briefly, do the existing fade and remove.
      this.scene.time.delayedCall(260, () => {
        this.feedback.playDeath(ev.unitId, () => {
          this.unitRenderer.setUnitExternallyAnimating(ev.unitId, false);
          this.unitRenderer.destroyUnitVisual(ev.unitId);
          this.renderStore.finalizeRemoveUnit(ev.unitId);
        });
      });
    }
  }
}
