import Phaser from "phaser";
import { BOARD } from "../board/BoardConfig";
import { BoardRenderer } from "../board/BoardRenderer";
import { TileOverlay } from "../board/TileOverlay";
import { TilePicker } from "../input/TilePicker";
import { createInitialUnits } from "../units/initialUnits";
import { UnitRenderer } from "../units/UnitRenderer";
import { SelectionController } from "../controllers/SelectionController";
import { TurnController } from "../controllers/TurnController";
import { MoveRangeOverlay } from "../movement/MoveRangeOverlay";
import { MovementController } from "../movement/MovementController";
import { PathPreviewOverlay } from "../movement/PathPreviewOverlay";
import { ActionBar } from "../ui/ActionBar";
import { AttackRangeOverlay } from "../combat/AttackRangeOverlay";
import { ProjectilePathOverlay } from "../combat/ProjectilePathOverlay";
import { UnitInfoHud, type HudUnitState } from "../ui/UnitInfoHud";
import { GameModel } from "../sim/GameModel";
import { ActionQueue } from "../sim/ActionQueue";
import { RenderStateStore } from "../render/RenderStateStore";
import { getUnitDef } from "../units/UnitCatalog";
import { SnapshotSyncClient } from "../net/SnapshotSyncClient";

export class BoardScene extends Phaser.Scene {
  private snapshotSync!: SnapshotSyncClient;

  create() {
    const cfg = BOARD;

    const renderer = new BoardRenderer(this, cfg);
    const bounds = renderer.draw(0, 0);

    const cam = this.cameras.main;
    const pad = 60;
    const boundsW = bounds.maxX - bounds.minX + pad * 2;
    const boundsH = bounds.maxY - bounds.minY + pad * 2;
    const fitZoom = Math.min(cam.width / boundsW, cam.height / boundsH) * 0.98;
    cam.setZoom(fitZoom * cfg.zoomOutFactor);
    cam.centerOn((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);

    const units = createInitialUnits();

    const model = new GameModel(units);

    const renderStore = new RenderStateStore();
    renderStore.applySnapshot(model.getSnapshot());

    const actions = new ActionQueue({
      model,
      cfg,
      onApplied: (res) => {
        if (res.ok) renderStore.applyEvents(res.events);
      },
    });

    const unitRenderer = new UnitRenderer(this, cfg, renderStore);
    unitRenderer.create();

    const moveOverlay = new MoveRangeOverlay(this, cfg);
    moveOverlay.setReachableTiles([]);

    const attackOverlay = new AttackRangeOverlay(this, cfg);
    const overlay = new TileOverlay(this, cfg);
    const picker = new TilePicker(this, cfg, cam);

    const tileToWorld = (t: { x: number; y: number }) => ({
      x: (t.x - t.y) * (cfg.tileW / 2),
      y: (t.x + t.y) * (cfg.tileH / 2),
    });

    const pathPreview = new PathPreviewOverlay(this, tileToWorld, cfg.tileW, cfg.tileH);
    const projectilePathOverlay = new ProjectilePathOverlay(this, tileToWorld, cfg.tileW, cfg.tileH);

    const movement = new MovementController({
      scene: this,
      cam,
      cfg,
      model,
      actions,
      unitRenderer,
      renderStore,
      moveOverlay,
      pathPreview,
    });

    const turns = new TurnController({
      scene: this,
      cam,
      unitRenderer,
      overlay,
      movement,
      model,
      actions,
      renderStore,
    });

    const actionBar = new ActionBar({
      scene: this,
      cam,
      onEndTurn: () => turns.endTurn(),
    });

    const unitInfoHud = new UnitInfoHud({ scene: this, cam });
    const enemyInfoHud = new UnitInfoHud({ scene: this, cam, anchor: "right" });
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

    this.snapshotSync = new SnapshotSyncClient({
      model,
      renderStore,
      unitRenderer,
      movement,
      overlay,
      onAfterSync: () => {
        if (enemyInfoUnitId && !renderStore.getUnit(enemyInfoUnitId)) enemyInfoUnitId = null;
      },
    });

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

    new SelectionController({
      scene: this,
      cam,
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
}
