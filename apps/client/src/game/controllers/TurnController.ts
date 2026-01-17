import Phaser from "phaser";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { Unit, Team } from "../units/UnitTypes";
import { TurnState } from "../turns/TurnState";
import { TurnHud } from "../ui/TurnHud";
import { CombatResolver } from "../combat/CombatResolver";

export class TurnController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private unitRenderer: UnitRenderer;
  private overlay: TileOverlay;
  private movement: MovementController;

  // Needed for projectile LoS (blockers)
  private units: Unit[];

  private state = new TurnState();
  private hud: TurnHud;
  private combat = new CombatResolver();

  // When a move consumes the last AP, we auto-end AFTER the move tween finishes.
  private pendingAutoEndAfterMove = false;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    unitRenderer: UnitRenderer;
    overlay: TileOverlay;
    movement: MovementController;
    units: Unit[];
  }) {
    this.scene = args.scene;
    this.cam = args.cam;
    this.unitRenderer = args.unitRenderer;
    this.overlay = args.overlay;
    this.movement = args.movement;
    this.units = args.units;

    this.hud = new TurnHud({ scene: this.scene, cam: this.cam });

    this.scene.input.keyboard?.on("keydown-E", () => this.endTurn());
    this.scene.events.on("postupdate", () => this.hud.updatePosition());

    this.scene.events.on("move:complete", () => {
      if (this.pendingAutoEndAfterMove) {
        this.pendingAutoEndAfterMove = false;
        this.endTurn();
      } else {
        this.refreshHud();
      }
    });

    this.refreshHud();
    this.hud.updatePosition();
  }

  getActiveTeam(): Team {
    return this.state.getActiveTeam();
  }

  canControlUnit(unit: Unit): boolean {
    return this.state.canControlUnit(unit);
  }

  getRemainingActionPoints(unit: Unit): number {
    return this.state.getRemainingAp(unit);
  }

  canActWithUnit(unit: Unit): boolean {
    if (!this.state.canAct(unit)) return false;
    if (this.movement.isAnimatingMove()) return false;
    return true;
  }

  spendForMove(unit: Unit, tilesMoved: number): boolean {
    const ok = this.state.spendForMove(unit, tilesMoved);
    if (!ok) return false;

    this.refreshHud();

    if (this.state.getRemainingAp(unit) <= 0) {
      if (this.movement.isAnimatingMove()) {
        this.pendingAutoEndAfterMove = true;
      } else {
        this.endTurn();
      }
    }

    return true;
  }

  endTurn() {
    if (this.movement.isAnimatingMove()) return;

    this.pendingAutoEndAfterMove = false;
    this.state.endTurn();

    this.unitRenderer.setSelectedUnitId(null);
    this.overlay.setSelected(null);
    this.movement.setSelectedUnit(null);
    this.movement.setHoverTile(null);

    this.refreshHud();
  }

  /**
   * Attack:
   * - requires at least 1 AP remaining
   * - costs 1 AP and consumes all remaining AP
   * - projectile ranged uses LoS; may hit a blocking unit instead (can be friendly)
   */
  tryAttack(attacker: Unit, target: Unit): boolean {
    if (!this.canActWithUnit(attacker)) return false;

    const res = this.combat.tryAttack(attacker, target, this.units);
    if (!res.ok) return false;

    if (!this.state.spendForAttack(attacker)) return false;

    // Remove the actual hit unit (target or blocker)
    this.unitRenderer.removeUnit(res.hit.id);

    this.refreshHud();
    this.endTurn();
    return true;
  }

  private refreshHud() {
    const team = this.state.getActiveTeam();

    // Turn HUD only shows which team's turn it is.
    // Per-unit stats (including current/max AP) are displayed in UnitInfoHud.
    this.hud.setTurnInfo(team, "");
  }
}
