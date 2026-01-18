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
import { UnitInfoHud } from "../ui/UnitInfoHud";
import { GameModel } from "../sim/GameModel";
import { ActionQueue } from "../sim/ActionQueue";

export class BoardScene extends Phaser.Scene {
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

    // Central simulation/model (Phaser-free)
    const model = new GameModel(units);

    // Local sequencing scaffold (server-authoritative friendly)
    const actions = new ActionQueue({ model, cfg });

    // Rendering
    const unitRenderer = new UnitRenderer(this, cfg, model.getUnits());
    unitRenderer.create();

    // Overlays / input
    const moveOverlay = new MoveRangeOverlay(this, cfg, model.getUnits());
    moveOverlay.setSelectedUnit(null, []);

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
      unitRenderer,
      moveOverlay,
      pathPreview,
      model,
      actions,
    });

    const turns = new TurnController({
      scene: this,
      cam,
      unitRenderer,
      overlay,
      movement,
      model,
      actions,
    });

    const actionBar = new ActionBar({
      scene: this,
      cam,
      onEndTurn: () => turns.endTurn(),
    });

    const unitInfoHud = new UnitInfoHud({ scene: this, cam });

    this.events.on("postupdate", () => {
      actionBar.updatePosition();
      turns.update();

      const selected = unitRenderer.getSelectedUnit();
      const remainingAp = selected ? turns.getRemainingActionPoints(selected) : undefined;
      unitInfoHud.setUnit(selected, remainingAp);
      unitInfoHud.updatePosition();
    });

    new SelectionController({
      scene: this,
      cam,
      cfg,
      model,
      picker,
      overlay,
      unitRenderer,
      movement,
      turns,
      actionBar,
      attackOverlay,
      projectilePathOverlay,
    }).attach();
  }
}
