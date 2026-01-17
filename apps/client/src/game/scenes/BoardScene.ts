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
    });

    const turns = new TurnController({
      scene: this,
      cam,
      unitRenderer,
      overlay,
      movement,
      model,
    });

    const actionBar = new ActionBar({
      scene: this,
      cam,
      onEndTurn: () => turns.endTurn(),
    });

    const unitInfoHud = new UnitInfoHud({ scene: this, cam, anchor: "left" });
    const hoverEnemyHud = new UnitInfoHud({ scene: this, cam, anchor: "right" });

    // Mobile-friendly: when no active-team unit is selected, clicking an enemy unit
    // OR the tile the enemy is standing on will "inspect" it and show its info on the right HUD.
    // IMPORTANT: once you hover any enemy, the inspected unit is cleared and will NOT return.
    let inspectedEnemyId: string | null = null;

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Only when the active team has no selected unit.
      const selected = unitRenderer.getSelectedUnit();
      if (selected) return;

      // 1) Direct unit hit (clicking the unit).
      const world = cam.getWorldPoint(pointer.x, pointer.y);
      let clicked = unitRenderer.pickUnitAtWorldPoint(world.x, world.y);

      // 2) If missed, try tile under pointer (clicking the tile the unit is on).
      if (!clicked) {
        const hitTile = picker.getTileAtPointer(pointer);
        if (hitTile) {
          clicked = model.getUnitAtTile(hitTile.x, hitTile.y);
        }
      }

      if (clicked && clicked.team !== model.getActiveTeam()) {
        inspectedEnemyId = clicked.id;
      } else {
        inspectedEnemyId = null;
      }
    });

    this.events.on("postupdate", () => {
      actionBar.updatePosition();
      turns.update();

      const selected = unitRenderer.getSelectedUnit();
      const remainingAp = selected ? turns.getRemainingActionPoints(selected) : undefined;
      unitInfoHud.setUnit(selected, remainingAp);
      unitInfoHud.updatePosition();

      // Right-side HUD:
      // - If hovering an enemy (unit OR tile), show that enemy and clear any inspected selection.
      // - If not hovering an enemy, show inspected enemy ONLY if no hover has happened since it was set.
      const pointer = this.input.activePointer;

      // 1) Direct unit hover.
      const world = cam.getWorldPoint(pointer.x, pointer.y);
      let hovered = unitRenderer.pickUnitAtWorldPoint(world.x, world.y);

      // 2) If no unit directly under pointer, resolve by tile under pointer.
      if (!hovered) {
        const hitTile = picker.getTileAtPointer(pointer);
        if (hitTile) {
          hovered = model.getUnitAtTile(hitTile.x, hitTile.y);
        }
      }

      const perspectiveTeam = selected?.team ?? model.getActiveTeam();

      // If you have a selected unit, the right HUD should be driven only by hover.
      if (selected) inspectedEnemyId = null;

      const showHover = hovered != null && hovered.team !== perspectiveTeam;

      // Key change: any hover clears inspected, so when hover ends the HUD does NOT revert.
      if (showHover) inspectedEnemyId = null;

      const inspected = !selected && inspectedEnemyId ? model.getUnitById(inspectedEnemyId) : null;
      const showInspected = inspected != null && inspected.team !== perspectiveTeam;

      hoverEnemyHud.setUnit(showHover ? hovered : showInspected ? inspected : null);
      hoverEnemyHud.updatePosition();
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
