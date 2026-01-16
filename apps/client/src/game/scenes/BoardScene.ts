import Phaser from "phaser";
import { BOARD } from "../board/BoardConfig";
import { BoardRenderer } from "../board/BoardRenderer";
import { TileOverlay } from "../board/TileOverlay";
import { TilePicker } from "../input/TilePicker";
import { createInitialUnits } from "../units/initialUnits";
import { UnitRenderer } from "../units/UnitRenderer";
import { SelectionController } from "../controllers/SelectionController";
import { MoveRangeOverlay } from "../movement/MoveRangeOverlay";

export class BoardScene extends Phaser.Scene {
  create() {
    const cfg = BOARD;

    // Render static board + get bounds
    const renderer = new BoardRenderer(this, cfg);
    const bounds = renderer.draw(0, 0);

    // Fit camera
    const cam = this.cameras.main;
    const pad = 60;
    const boundsW = (bounds.maxX - bounds.minX) + pad * 2;
    const boundsH = (bounds.maxY - bounds.minY) + pad * 2;
    const fitZoom = Math.min(cam.width / boundsW, cam.height / boundsH) * 0.98;
    cam.setZoom(fitZoom * cfg.zoomOutFactor);
    cam.centerOn((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);

    // Units
    const units = createInitialUnits();
    const unitRenderer = new UnitRenderer(this, cfg, units);
    unitRenderer.create();

    const moveOverlay = new MoveRangeOverlay(this, cfg, units);
    moveOverlay.setSelectedUnit(null);

    // Overlay + picker
    const overlay = new TileOverlay(this, cfg);
    const picker = new TilePicker(this, cfg, cam);

    // Input wiring
    new SelectionController(this, cam, picker, overlay, unitRenderer, moveOverlay).attach();
  }
}
