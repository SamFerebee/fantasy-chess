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
  // Rules:
  // - Click enemy (no friendly selected) => pin enemy, persists when moving mouse away
  // - Hover enemy always shows hovered enemy (even if friendly selected)
  // - If you hover a DIFFERENT enemy than the pinned one, clear pin so hover-out => nothing
  //   (but hovering the same pinned enemy must NOT clear pin, or click won't persist)
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
    const sel = this.unitRenderer.getSelectedUnit();
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
    // If a friendly is selected, click-pin should not apply.
    if (this.isFriendlySelected()) {
      this.pinnedEnemyId = null;

      const effective = this.hoverEnemyId; // hover-only while friendly selected
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
    this.actionBar.onModeChanged((mode) => this.overlayMode.applyMode(mode));

    this.picker.onHover((hit) => {
      this.overlay.setHovered(hit);
      this.overlayMode.handleHover(hit);

      const hoveredEnemyId = this.getEnemyIdAtTile(hit);
      this.hoverEnemyId = hoveredEnemyId;

      // Only clear the pin if the hover is on a DIFFERENT enemy than the pinned one.
      // This preserves click-to-pin when you're still hovering the clicked enemy,
      // but satisfies: hover a different enemy -> hover-out => nothing.
      if (hoveredEnemyId && this.pinnedEnemyId && hoveredEnemyId !== this.pinnedEnemyId) {
        this.pinnedEnemyId = null;
      }

      this.emitEnemyHudIfChanged();
    });

    this.picker.onSelect((hit) => {
      // Click-pin only when NO FRIENDLY unit is selected.
      if (!this.isFriendlySelected()) {
        this.pinnedEnemyId = this.getEnemyIdAtTile(hit);
        this.emitEnemyHudIfChanged(true); // immediate update; do not wait for hover
      }

      this.clickHandler.onTileSelected(hit);
    });

    this.overlayMode.applyMode(this.actionBar.getMode());
    this.emitEnemyHudIfChanged(true);
  }
}
