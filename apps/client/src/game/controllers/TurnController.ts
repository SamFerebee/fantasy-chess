import Phaser from "phaser";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { Unit, Team } from "../units/UnitTypes";
import { TurnHud } from "../ui/TurnHud";
import type { GameModel } from "../sim/GameModel";
import type { ApplyResult } from "../sim/GameActions";
import { CombatFeedback } from "../ui/CombatFeedback";

export class TurnController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private unitRenderer: UnitRenderer;
  private overlay: TileOverlay;
  private movement: MovementController;

  /**
   * Simulation/model container (no Phaser dependencies).
   * Owns: AP rules, turn switching, attacks, and unit removal.
   */
  private model: GameModel;

  private hud: TurnHud;
  private feedback: CombatFeedback;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    unitRenderer: UnitRenderer;
    overlay: TileOverlay;
    movement: MovementController;
    model: GameModel;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.unitRenderer = args.unitRenderer;
    this.overlay = args.overlay;
    this.movement = args.movement;
    this.model = args.model;

    this.hud = new TurnHud({ scene: this.scene, cam: this.cam });
    this.feedback = new CombatFeedback({ scene: this.scene, unitRenderer: this.unitRenderer });

    this.scene.input.keyboard?.on("keydown-E", () => this.endTurn());
    this.scene.events.on("postupdate", () => this.hud.updatePosition());

    this.refreshHud();
    this.hud.updatePosition();
  }

  /** Call every frame (cheap) to keep HUD in sync with model state. */
  update() {
    this.refreshHud();
  }

  getActiveTeam(): Team {
    return this.model.getActiveTeam();
  }

  canControlUnit(unit: Unit): boolean {
    return this.model.canControlUnit(unit);
  }

  getRemainingActionPoints(unit: Unit): number {
    return this.model.getRemainingActionPoints(unit);
  }

  canActWithUnit(unit: Unit): boolean {
    if (!this.model.canActWithUnit(unit)) return false;
    if (this.movement.isAnimatingMove()) return false;
    return true;
  }

  /**
   * Applies an attack (model authoritative), then applies UI side-effects:
   * - hit feedback (flash + floating damage number)
   * - death feedback (fade/shrink) then destroy unit visuals
   * - clear selection/overlays if the action ended the turn
   */
  tryAttackUnit(attacker: Unit, target: Unit): ApplyResult {
    if (!this.canActWithUnit(attacker)) return { ok: false, reason: "notYourTurn" };

    const res = this.model.applyAction({ type: "attackUnit", attackerId: attacker.id, targetId: target.id });
    if (!res.ok) return res;

    // Feedback loop:
    // - If the attack dealt damage: show that number on the hit unit
    // - If the attack dealt 0 damage (e.g., armor): show 0 on the hit unit
    // - If the hit unit died: play death anim, then destroy visuals
    const damagedTargets = new Set<string>();

    for (const ev of res.events) {
      if (ev.type === "unitDamaged") {
        damagedTargets.add(ev.targetId);
        this.feedback.playHit(ev.targetId, ev.amount);
      }
    }

    for (const ev of res.events) {
      if (ev.type === "unitHpChanged") {
        if (!damagedTargets.has(ev.unitId)) {
          // No unitDamaged event means damage was 0 for this hit.
          this.feedback.playHit(ev.unitId, 0);
        }
      }
    }

    for (const ev of res.events) {
      if (ev.type === "unitRemoved") {
        this.feedback.playDeath(ev.unitId, () => this.unitRenderer.destroyUnitVisual(ev.unitId));
      }
    }

    // If the model ended the turn, clear selection/overlays.
    const ended = res.events.some((e) => e.type === "turnEnded");
    if (ended) this.clearSelectionAndOverlays();

    return res;
  }

  endTurn() {
    if (this.movement.isAnimatingMove()) return;

    this.model.applyAction({ type: "endTurn" });
    this.clearSelectionAndOverlays();
  }

  private clearSelectionAndOverlays() {
    this.unitRenderer.setSelectedUnitId(null);
    this.overlay.setSelected(null);
    this.movement.setSelectedUnitId(null);
    this.movement.setHoverTile(null);
    this.refreshHud();
  }

  private refreshHud() {
    const team = this.model.getActiveTeam();
    this.hud.setTurnInfo(team, "");
  }
}
