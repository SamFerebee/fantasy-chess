import Phaser from "phaser";

import { BOARD } from "../board/BoardConfig";
import { BoardRenderer } from "../board/BoardRenderer";
import { TileOverlay } from "../board/TileOverlay";

import { TilePicker } from "../input/TilePicker";

import { createInitialUnits } from "../units/initialUnits";
import { UnitRenderer } from "../units/UnitRenderer";
import { getUnitDef } from "../units/UnitCatalog";

import { GameModel } from "../sim/GameModel";
import { ActionQueue } from "../sim/ActionQueue";

import { RenderStateStore } from "../render/RenderStateStore";

import { MoveRangeOverlay } from "../movement/MoveRangeOverlay";
import { PathPreviewOverlay } from "../movement/PathPreviewOverlay";
import { MovementController } from "../movement/MovementController";

import { AttackRangeOverlay } from "../combat/AttackRangeOverlay";
import { ProjectilePathOverlay } from "../combat/ProjectilePathOverlay";

import { ActionBar } from "../ui/ActionBar";
import { UnitInfoHud, type HudUnitState } from "../ui/UnitInfoHud";

import { TurnController } from "../controllers/TurnController";
import { SelectionController } from "../controllers/SelectionController";

import { SnapshotSyncClient } from "../net/SnapshotSyncClient";
import { ClientEventEffects } from "../client/ClientEventEffects";

import { preloadGeneratedKnight, registerGeneratedKnightAnimations } from "../assets/GeneratedKnightSpriteSheet";

type BoardBounds = { minX: number; minY: number; maxX: number; maxY: number };

export class BoardScene extends Phaser.Scene {
  private snapshotSync!: SnapshotSyncClient;

  private boardRenderer!: BoardRenderer;
  private boardBounds!: BoardBounds;
  private cfg = BOARD;

  preload() {
    preloadGeneratedKnight(this);
  }

  create() {
    registerGeneratedKnightAnimations(this);

    const cfg = this.cfg;

    // Board
    this.boardRenderer = new BoardRenderer(this, cfg);
    this.boardBounds = this.boardRenderer.draw(0, 0) as BoardBounds;

    // Camera layout (initial)
    this.layoutCamera();

    // Re-layout camera on resize (critical for Phaser.Scale.RESIZE)
    this.scale.on("resize", () => {
      this.layoutCamera();
    });

    // Sim
    const units = createInitialUnits();
    const model = new GameModel(units);

    // Render-state store (authoritative for visuals)
    const renderStore = new RenderStateStore();
    renderStore.applySnapshot(model.getSnapshot());

    // Visuals
    const unitRenderer = new UnitRenderer(this, cfg, renderStore);
    unitRenderer.create();

    const clientFx = new ClientEventEffects({ scene: this, unitRenderer, renderStore });

    // Action queue: single write-path -> events -> renderStore + clientFx
    const actions = new ActionQueue({
      model,
      cfg,
      onApplied: (res) => {
        if (!res.ok) return;
        renderStore.applyEvents(res.events);
        clientFx.applyEvents(res.events);
      },
    });

    // Overlays + input
    const overlay = new TileOverlay(this, cfg);
    const picker = new TilePicker(this, cfg, this.cameras.main);

    const moveOverlay = new MoveRangeOverlay(this, cfg);
    moveOverlay.setReachableTiles([]);

    const attackOverlay = new AttackRangeOverlay(this, cfg);

    const tileToWorld = (t: { x: number; y: number }) => ({
      x: (t.x - t.y) * (cfg.tileW / 2),
      y: (t.x + t.y) * (cfg.tileH / 2),
    });

    const pathPreview = new PathPreviewOverlay(this, tileToWorld, cfg.tileW, cfg.tileH);
    const projectilePathOverlay = new ProjectilePathOverlay(this, tileToWorld, cfg.tileW, cfg.tileH);

    // Controllers
    const movement = new MovementController({
      scene: this,
      cam: this.cameras.main,
      cfg,
      model,
      actions,
      unitRenderer,
      moveOverlay,
      pathPreview,
    });

    const turns = new TurnController({
      scene: this,
      cam: this.cameras.main,
      unitRenderer,
      overlay,
      movement,
      model,
      actions,
    });

    const actionBar = new ActionBar({
      scene: this,
      cam: this.cameras.main,
      onEndTurn: () => turns.endTurn(),
    });

    // HUDs
    const unitInfoHud = new UnitInfoHud({ scene: this, cam: this.cameras.main });
    const enemyInfoHud = new UnitInfoHud({ scene: this, cam: this.cameras.main, anchor: "right" });
    let enemyInfoUnitId: string | null = null;

    const toHudUnit = (unitId: string | null): HudUnitState | null => {
      if (!unitId) return null;

      const ru = renderStore.getUnit(unitId);
      if (!ru) return null;

      const def = getUnitDef(ru.name);
      return {
        id: ru.id,
        name: ru.name,
        hp: ru.hp,
        maxHP: ru.maxHP,
        maxActionPoints: def.actionPoints,
        damage: def.damage,
        armor: def.armor,
      };
    };

    // Snapshot sync client (when you wire networking, this becomes the entrypoint)
    this.snapshotSync = new SnapshotSyncClient({
      model,
      renderStore,
      unitRenderer,
      movement,
      overlay,
      onAfterSync: () => {
        // If pinned enemy disappeared due to snapshot, clear it.
        if (enemyInfoUnitId && !renderStore.getUnit(enemyInfoUnitId)) enemyInfoUnitId = null;
      },
    });

    // Frame update
    this.events.on("postupdate", () => {
      actionBar.updatePosition();
      turns.update();

      const selectedId = unitRenderer.getSelectedUnitId();
      const selectedHud = toHudUnit(selectedId);

      const selectedSim = selectedId ? model.getUnitById(selectedId) : null;
      const remainingAp = selectedSim ? turns.getRemainingActionPoints(selectedSim) : undefined;

      unitInfoHud.setUnit(selectedHud, remainingAp);
      unitInfoHud.updatePosition();

      const enemyHud = toHudUnit(enemyInfoUnitId);
      enemyInfoHud.setUnit(enemyHud);
      enemyInfoHud.updatePosition();
    });

    // Selection (includes enemy HUD hover/click pin behavior)
    new SelectionController({
      scene: this,
      cam: this.cameras.main,
      cfg,
      model,
      renderStore,
      picker,
      overlay,
      unitRenderer,
      movement,
      turns,
      actionBar,
      attackOverlay,
      projectilePathOverlay,
      onEnemyInfoUnitChanged: (unitId) => {
        enemyInfoUnitId = unitId;
      },
    }).attach();
  }

  /**
   * Fit + center the board so it occupies most of the viewport.
   * IMPORTANT: must run on create AND on every resize when using Phaser.Scale.RESIZE.
   */
  private layoutCamera() {
    const cam = this.cameras.main;

    // Board bounds (world-space pixels, produced by BoardRenderer)
    const b = this.boardBounds;

    // Padding around the board in screen pixels (feel free to tweak)
    const pad = 80;

    const boundsW = b.maxX - b.minX + pad * 2;
    const boundsH = b.maxY - b.minY + pad * 2;

    // Recompute fit zoom from current camera viewport size
    const fitZoom = Math.min(cam.width / boundsW, cam.height / boundsH);

    // We want the board to take up the majority of the screen.
    // cfg.zoomOutFactor was originally used to zoom out; with fullscreen, that can make the board too small.
    // Clamp so it never becomes tiny.
    const desired = fitZoom * this.cfg.zoomOutFactor;
    const minZoom = fitZoom * 0.85; // ensures "mostly fills" even if zoomOutFactor is small
    cam.setZoom(Math.max(desired, minZoom));

    // Center on board
    cam.centerOn((b.minX + b.maxX) / 2, (b.minY + b.maxY) / 2);
  }
}
