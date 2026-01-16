import Phaser from "phaser";
import { BOARD } from "../board/BoardConfig";
import { BoardRenderer } from "../board/BoardRenderer";
import { TileOverlay } from "../board/TileOverlay";
import { TilePicker } from "../input/TilePicker";

export class BoardScene extends Phaser.Scene {
  create() {
    const cfg = BOARD;

    // 1) Render static board
    const renderer = new BoardRenderer(this, cfg);
    const bounds = renderer.draw(0, 0);

    // 2) Fit camera
    const cam = this.cameras.main;
    const pad = 60;

    const boundsW = (bounds.maxX - bounds.minX) + pad * 2;
    const boundsH = (bounds.maxY - bounds.minY) + pad * 2;

    const fitZoom = Math.min(cam.width / boundsW, cam.height / boundsH) * 0.98;
    cam.setZoom(fitZoom * cfg.zoomOutFactor);
    cam.centerOn((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);

    // 3) Overlay + input
    const overlay = new TileOverlay(this, cfg);
    const picker = new TilePicker(this, cfg, cam);

    picker.onHover((hit) => overlay.setHovered(hit));
    picker.onSelect((hit) => {
      overlay.setSelected(hit);
      if (hit) console.log("Selected tile:", hit.x, hit.y);
    });
  }
}
