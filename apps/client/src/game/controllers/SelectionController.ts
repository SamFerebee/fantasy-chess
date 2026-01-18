import Phaser from "phaser";
import type { BoardConfig } from "../board/BoardConfig";
import type { TileOverlay } from "../board/TileOverlay";
import type { AttackRangeOverlay } from "../combat/AttackRangeOverlay";
import type { ProjectilePathOverlay } from "../combat/ProjectilePathOverlay";
import type { TilePicker } from "../input/TilePicker";
import type { MovementController } from "../movement/MovementController";
import type { RenderStateStore } from "../render/RenderStateStore";
import type { GameModel } from "../sim/GameModel";
import type { ActionBar } from "../ui/ActionBar";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { TurnController } from "./TurnController";

import { createOverlayModeManager } from "./selection/OverlayModeManager";
import { createSelectionClickHandler } from "./selection/SelectionClickHandler";

export class SelectionController {
  private picker: TilePicker;
  private overlay: TileOverlay;
  private unitRenderer: UnitRenderer;
  private movement: MovementController;
  private turns: TurnController;
  private actionBar: ActionBar;
  private model: GameModel;
  private renderStore: RenderStateStore;

  private overlayMode: ReturnType<typeof createOverlayModeManager>;
  private clickHandler: ReturnType<typeof createSelectionClickHandler>;

  private pinnedEnemyId: string | null = null;
  private hoverEnemyId: string | null = null;
  private lastEmittedEnemyId: string | null = null;

  private onEnemyInfoUnitChanged: (unitId: string | null) => void;

  constructor(args: {
    scene: Phaser.Scene;
    cam: Phaser.Cameras.Scene2D.Camera;
    cfg: BoardConfig;
    model: GameModel;
    renderStore: RenderStateStore;
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
    this.picker = args.picker;
    this.overlay = args.overlay;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
    this.turns = args.turns;
    this.actionBar = args.actionBar;
    this.model = args.model;
    this.renderStore = args.renderStore;

    this.onEnemyInfoUnitChanged = args.onEnemyInfoUnitChanged ?? (() => {});

    const getLosUnits = () => this.renderStore.getUnits().map((u) => ({ id: u.id, x: u.x, y: u.y }));

    this.overlayMode = createOverlayModeManager({
      cfg: args.cfg,
      getLosUnits,
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

    const u = this.renderStore.getUnit(selId);
    if (!u) return false;

    return u.team === this.getActiveTeam();
  }

  private getEnemyIdAtTile(hit: { x: number; y: number } | null): string | null {
    if (!hit) return null;

    const id = this.renderStore.getUnitIdAtTile(hit.x, hit.y);
    if (!id) return null;

    const u = this.renderStore.getUnit(id);
    if (!u) return null;

    const active = this.getActiveTeam();
    return u.team !== active ? u.id : null;
  }

  private emitEnemyHudIfChanged(force?: boolean) {
    if (this.isFriendlySelected()) {
      this.pinnedEnemyId = null;

      const effective = this.hoverEnemyId;
      if (force || effective !== this.lastEmittedEnemyId) {
        this.lastEmittedEnemyId = effective;
        this.onEnemyInfoUnitChanged(effective);
      }
      return;
    }

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

      if (hoveredEnemyId && this.pinnedEnemyId && hoveredEnemyId !== this.pinnedEnemyId) {
        this.pinnedEnemyId = null;
      }

      this.emitEnemyHudIfChanged();
    });

    this.picker.onSelect((hit) => {
      if (!this.isFriendlySelected()) {
        this.pinnedEnemyId = this.getEnemyIdAtTile(hit);
        this.emitEnemyHudIfChanged(true);
      }

      this.clickHandler.onTileSelected(hit);
    });

    this.overlayMode.applyMode(this.actionBar.getMode());
    this.emitEnemyHudIfChanged(true);
  }
}
