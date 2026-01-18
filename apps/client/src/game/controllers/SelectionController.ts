import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { TileOverlay } from "../board/TileOverlay";
import type { AttackRangeOverlay } from "../combat/AttackRangeOverlay";
import type { ProjectilePathOverlay } from "../combat/ProjectilePathOverlay";
import type { TilePicker } from "../input/TilePicker";
import type { MovementController } from "../movement/MovementController";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { ActionBar } from "../ui/ActionBar";
import type { TurnController } from "./TurnController";
import type { GameModel } from "../sim/GameModel";

import { createOverlayModeManager } from "./selection/OverlayModeManager";
import { createSelectionClickHandler } from "./selection/SelectionClickHandler";

export class SelectionController {
  private scene: Phaser.Scene;
  private picker: TilePicker;
  private overlay: TileOverlay;
  private unitRenderer: UnitRenderer;
  private movement: MovementController;
  private turns: TurnController;
  private actionBar: ActionBar;
  private model: GameModel;

  private overlayMode: ReturnType<typeof createOverlayModeManager>;
  private clickHandler: ReturnType<typeof createSelectionClickHandler>;

  // Enemy HUD state:
  // - pinnedEnemyId: set by click when NO FRIENDLY unit is selected (keeps info up)
  // - hoverEnemyId: transient; overrides pinned while hovering an enemy tile/unit
  //
  // Spec behavior:
  // - Hover enemy => show hovered
  // - Click enemy with no friendly selected => show/pin clicked enemy (mobile equivalent)
  // - If you later hover a DIFFERENT enemy, HUD shows hovered; when hover ends => clears (no revert)
  private pinnedEnemyId: string | null = null;
  private hoverEnemyId: string | null = null;
  private lastEmittedEnemyId: string | null = null;

  private onEnemyInfoUnitChanged: (unitId: string | null) => void;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    cfg: BoardConfig;
    model: GameModel;
    picker: TilePicker;
    overlay: TileOverlay;
    unitRenderer: UnitRenderer;
    movement: MovementController;
    turns: TurnController;
    actionBar: ActionBar;
    attackOverlay: AttackRangeOverlay;
    projectilePathOverlay: ProjectilePathOverlay;
    onEnemyInfoUnitChanged?: (unitId: string | null) => void;
  }) {
    this.scene = args.scene;
    this.picker = args.picker;
    this.overlay = args.overlay;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
    this.turns = args.turns;
    this.actionBar = args.actionBar;
    this.model = args.model;

    this.onEnemyInfoUnitChanged = args.onEnemyInfoUnitChanged ?? (() => {});

    const getUnits = () => args.model.getUnits();

    this.overlayMode = createOverlayModeManager({
      cfg: args.cfg,
      getUnits,
      model: args.model,
      unitRenderer: this.unitRenderer,
      turns: this.turns,
      movement: this.movement,
      actionBar: this.actionBar,
      attackOverlay: args.attackOverlay,
      projectilePathOverlay: args.projectilePathOverlay,
    });

    this.clickHandler = createSelectionClickHandler({
      cfg: args.cfg,
      model: args.model,
      overlay: this.overlay,
      unitRenderer: this.unitRenderer,
      movement: this.movement,
      turns: this.turns,
      actionBar: this.actionBar,
      overlayMode: this.overlayMode,
    });
  }

  private getActiveTeam() {
    return this.turns.getActiveTeam();
  }

  private isFriendlySelected(): boolean {
    const selId = this.unitRenderer.getSelectedUnitId();
    if (!selId) return false;

    const sel = this.model.getUnitById(selId);
    if (!sel) return false;

    return sel.team === this.getActiveTeam();
  }

  private getEnemyIdAtTile(hit: { x: number; y: number } | null): string | null {
    if (!hit) return null;

    const active = this.getActiveTeam();
    const u = this.model.getUnitAtTile(hit.x, hit.y);
    if (!u) return null;

    return u.team !== active ? u.id : null;
  }

  private emitEnemyHudIfChanged(force?: boolean) {
    // If a friendly is selected, clicks should not pin.
    if (this.isFriendlySelected()) {
      this.pinnedEnemyId = null;

      const effective = this.hoverEnemyId;
      if (force || effective !== this.lastEmittedEnemyId) {
        this.lastEmittedEnemyId = effective;
        this.onEnemyInfoUnitChanged(effective);
      }
      return;
    }

    // No friendly selected:
    // - hover overrides pin
    // - if not hovering an enemy, show pinned (if any)
    const effective = this.hoverEnemyId ?? this.pinnedEnemyId;
    if (force || effective !== this.lastEmittedEnemyId) {
      this.lastEmittedEnemyId = effective;
      this.onEnemyInfoUnitChanged(effective);
    }
  }

  attach() {
    // Mode changes update overlays (move range vs attack range).
    this.actionBar.onModeChanged((mode) => this.overlayMode.applyMode(mode));

    // Hover updates the tile outline + (in attack mode) projectile path preview + enemy HUD.
    this.picker.onHover((hit) => {
      this.overlay.setHovered(hit);
      this.overlayMode.handleHover(hit);

      const hoveredEnemyId = this.getEnemyIdAtTile(hit);
      this.hoverEnemyId = hoveredEnemyId;

      // If you hover a DIFFERENT enemy than the pinned one, clear the pin so that
      // hover-out results in "nothing" (no revert).
      // Do NOT clear if you are hovering the pinned enemy itself, or click wouldn't persist.
      if (hoveredEnemyId && this.pinnedEnemyId && hoveredEnemyId !== this.pinnedEnemyId) {
        this.pinnedEnemyId = null;
      }

      this.emitEnemyHudIfChanged();
    });

    // Click selection / actions + enemy HUD pinning behavior.
    this.picker.onSelect((hit) => {
      // Click-pin only when NO FRIENDLY unit is selected.
      if (!this.isFriendlySelected()) {
        this.pinnedEnemyId = this.getEnemyIdAtTile(hit);
        this.emitEnemyHudIfChanged(true); // immediate update (don't wait for hover)
      }

      this.clickHandler.onTileSelected(hit);
    });

    // Initialize for default action mode.
    this.overlayMode.applyMode(this.actionBar.getMode());
    this.emitEnemyHudIfChanged(true);
  }
}
