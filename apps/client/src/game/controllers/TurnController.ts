import Phaser from "phaser";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { Unit, Team } from "../units/UnitTypes";
import type { TileCoord } from "../movement/path";
import { TurnHud } from "../ui/TurnHud";
import type { GameModel } from "../sim/GameModel";
import type { ApplyResult } from "../sim/GameActions";
import { CombatFeedback } from "../ui/CombatFeedback";
import type { ActionQueue } from "../sim/ActionQueue";

export class TurnController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private unitRenderer: UnitRenderer;
  private overlay: TileOverlay;
  private movement: MovementController;

  private model: GameModel;
  private actions: ActionQueue;

  private hud: TurnHud;
  private feedback: CombatFeedback;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    unitRenderer: UnitRenderer;
    overlay: TileOverlay;
    movement: MovementController;
    model: GameModel;
    actions: ActionQueue;
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.unitRenderer = args.unitRenderer;
    this.overlay = args.overlay;
    this.movement = args.movement;
    this.model = args.model;
    this.actions = args.actions;

    this.hud = new TurnHud({ scene: this.scene, cam: this.cam });
    this.feedback = new CombatFeedback({ scene: this.scene, unitRenderer: this.unitRenderer });

    // Key directive: pressing E should NOT end turn (especially for mobile), so no keyboard binding here.
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
   * Tile-targeted attack (server-authoritative-friendly).
   * Applies attack via ActionQueue, then performs UI side-effects:
   * - hit feedback (flash + floating damage number)
   * - death feedback (fade/shrink) then destroy unit visuals
   * - clear selection/overlays if the action ended the turn
   */
  tryAttackTile(attacker: Unit, target: TileCoord): ApplyResult {
    if (!this.canActWithUnit(attacker)) return { ok: false, reason: "notYourTurn" };

    const res = this.actions.submitLocal({ type: "attackTile", attackerId: attacker.id, target });
    if (!res.ok) return res;

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

  /** Convenience wrapper for older call sites that still think in "unit target". */
  tryAttackUnit(attacker: Unit, target: Unit): ApplyResult {
    return this.tryAttackTile(attacker, { x: target.x, y: target.y });
  }

  endTurn() {
    if (this.movement.isAnimatingMove()) return;

    this.actions.submitLocal({ type: "endTurn" });
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
