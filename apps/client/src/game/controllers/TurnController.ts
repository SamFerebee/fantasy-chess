import Phaser from "phaser";

import type { TileOverlay } from "../board/TileOverlay";
import type { MovementController } from "../movement/MovementController";
import type { TileCoord } from "../movement/path";
import type { ActionQueue } from "../sim/ActionQueue";
import type { ApplyResult } from "../sim/GameActions";
import type { GameModel } from "../sim/GameModel";
import type { Unit, Team } from "../units/UnitTypes";
import type { UnitRenderer } from "../units/UnitRenderer";
import { TurnHud } from "../ui/TurnHud";

export class TurnController {
  private scene: Phaser.Scene;
  private cam: Phaser.Cameras.Scene2D.Camera;
  private unitRenderer: UnitRenderer;
  private overlay: TileOverlay;
  private movement: MovementController;

  private model: GameModel;
  private actions: ActionQueue;

  private hud: TurnHud;

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
   * Tile-targeted attack.
   * All gameplay validation is in sim. This just submits the intent and does UI-only side effects.
   */
  tryAttackTile(attacker: Unit, target: TileCoord): ApplyResult {
    if (this.movement.isAnimatingMove()) return { ok: false, reason: "notYourTurn" };

    const res = this.actions.submitLocal({ type: "attackTile", attackerId: attacker.id, target });
    if (!res.ok) return res;

    const ended = res.events.some((e) => e.type === "turnEnded");
    if (ended) this.clearSelectionAndOverlays();

    return res;
  }

  /** Convenience wrapper for existing call sites that still think in "unit target". */
  tryAttackUnit(attacker: Unit, target: Unit): ApplyResult {
    return this.tryAttackTile(attacker, { x: target.x, y: target.y });
  }

  /**
   * Single sim-authored action: move next to target (within budget) then attack.
   * Attack events may be staged in res.postMoveEvents.
   */
  tryMeleeChaseAttack(attacker: Unit, target: Unit): ApplyResult {
    if (this.movement.isAnimatingMove()) return { ok: false, reason: "notYourTurn" };

    const res = this.actions.submitLocal({ type: "meleeChaseAttack", attackerId: attacker.id, targetId: target.id });
    if (!res.ok) return res;

    // If this resolved immediately as an attack (already adjacent), it may end the turn now.
    const endedNow = res.events.some((e) => e.type === "turnEnded");
    if (endedNow) this.clearSelectionAndOverlays();

    return res;
  }

  endTurn() {
    if (this.movement.isAnimatingMove()) return;

    this.actions.submitLocal({ type: "endTurn" });
    this.clearSelectionAndOverlays();
  }

  clearSelectionAndOverlays() {
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
