import Phaser from "phaser";
import type { TilePicker } from "../input/TilePicker";
import type { TileOverlay } from "../board/TileOverlay";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { TurnController } from "./TurnController";
import type { ActionBar } from "../ui/ActionBar";
import type { BoardConfig } from "../board/BoardConfig";
import type { AttackRangeOverlay } from "../combat/AttackRangeOverlay";
import type { ProjectilePathOverlay } from "../combat/ProjectilePathOverlay";
import type { Unit } from "../units/UnitTypes";

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
    units: Unit[];
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

    this.overlayMode = createOverlayModeManager({
      cfg: args.cfg,
      units: args.units,
      unitRenderer: this.unitRenderer,
      turns: this.turns,
      movement: this.movement,
      actionBar: this.actionBar,
      attackOverlay: args.attackOverlay,
      projectilePathOverlay: args.projectilePathOverlay,
    });

    this.clickHandler = createSelectionClickHandler({
      scene: this.scene,
      cam: args.cam,
      cfg: args.cfg,
      units: args.units,
      picker: this.picker,
      overlay: this.overlay,
      unitRenderer: this.unitRenderer,
      movement: this.movement,
      turns: this.turns,
      actionBar: this.actionBar,
      overlayMode: this.overlayMode,
    });
  }

  attach() {
    this.actionBar.onModeChanged((mode) => this.overlayMode.applyMode(mode));

    this.picker.onHover((hit) => {
      this.overlay.setHovered(hit);
      this.overlayMode.handleHover(hit);
    });

    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.clickHandler.onPointerDown(pointer);
    });

    this.overlayMode.applyMode(this.actionBar.getMode());
  }
}
