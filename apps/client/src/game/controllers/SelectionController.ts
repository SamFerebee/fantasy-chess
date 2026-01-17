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

  private overlayMode: ReturnType<typeof createOverlayModeManager>;
  private clickHandler: ReturnType<typeof createSelectionClickHandler>;

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
  }) {
    this.scene = args.scene;
    this.picker = args.picker;
    this.overlay = args.overlay;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
    this.turns = args.turns;
    this.actionBar = args.actionBar;

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

  attach() {
    // Mode changes update overlays (move range vs attack range).
    this.actionBar.onModeChanged((mode) => this.overlayMode.applyMode(mode));

    // Hover updates the tile outline + (in attack mode) projectile path preview.
    this.picker.onHover((hit) => {
      this.overlay.setHovered(hit);
      this.overlayMode.handleHover(hit);
    });

    // Click selection / actions.
    this.picker.onSelect((hit) => {
      this.clickHandler.onTileSelected(hit);
    });

    // Initialize for default action mode.
    this.overlayMode.applyMode(this.actionBar.getMode());
  }
}
