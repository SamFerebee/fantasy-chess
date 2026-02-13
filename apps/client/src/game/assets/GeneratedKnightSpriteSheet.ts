import Phaser from "phaser";

import type { BoardConfig } from "../board/BoardConfig";
import { isoToScreen } from "../board/iso";
import type { TileCoord } from "../movement/path";

/**
 * Generated first-pass knight spritesheet integration.
 *
 * IMPORTANT: This first pass sheet is a 4x6 grid (4 facings x 6 actions) with
 * 1 frame per action. It gives immediate visual progress, but it is NOT a
 * smooth multi-frame animation set yet.
 */

// Place the PNG at: apps/client/public/assets/units/generated/knight_sheet.png
export const GEN_KNIGHT_SHEET_KEY = "gen_knight";
export const GEN_KNIGHT_SHEET_URL = "assets/units/generated/knight_sheet.png";
export const GEN_KNIGHT_FRAME_W = 256;
export const GEN_KNIGHT_FRAME_H = 256;

/**
 * The sheet columns are 4 isometric facings. The sheet you generated visually
 * reads as the 4 diagonal facings: SW, NW, SE, NE.
 *
 * Column mapping (left->right):
 *  - 0: SW
 *  - 1: NW
 *  - 2: SE
 *  - 3: NE
 */
export type IsoFacing4 = "SW" | "NW" | "SE" | "NE";

/**
 * The sheet rows are 6 actions.
 * Row mapping (top->bottom):
 *  - 0: idle
 *  - 1: walk
 *  - 2: attack
 *  - 3: hit
 *  - 4: block
 *  - 5: death
 */
export type KnightAction = "idle" | "walk" | "attack" | "hit" | "block" | "death";

const ACTION_ROW: Record<KnightAction, number> = {
  idle: 0,
  walk: 1,
  attack: 2,
  hit: 3,
  block: 4,
  death: 5,
};

const FACING_COL: Record<IsoFacing4, number> = {
  SW: 0,
  NW: 1,
  SE: 2,
  NE: 3,
};

export function preloadGeneratedKnight(scene: Phaser.Scene) {
  // Avoid double-loading if multiple scenes ever exist.
  if (scene.textures.exists(GEN_KNIGHT_SHEET_KEY)) return;

  scene.load.spritesheet(GEN_KNIGHT_SHEET_KEY, GEN_KNIGHT_SHEET_URL, {
    frameWidth: GEN_KNIGHT_FRAME_W,
    frameHeight: GEN_KNIGHT_FRAME_H,
  });
}

export function registerGeneratedKnightAnimations(scene: Phaser.Scene) {
  if (!scene.textures.exists(GEN_KNIGHT_SHEET_KEY)) return;

  const actions: KnightAction[] = ["idle", "walk", "attack", "hit", "block", "death"];
  const facings: IsoFacing4[] = ["SW", "NW", "SE", "NE"];

  for (const action of actions) {
    for (const facing of facings) {
      const key = knightAnimKey(action, facing);
      if (scene.anims.exists(key)) continue;

      const frame = knightFrameIndex(action, facing);
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(GEN_KNIGHT_SHEET_KEY, { start: frame, end: frame }),
        frameRate: 6,
        repeat: action === "idle" || action === "walk" ? -1 : 0,
      });
    }
  }
}

export function knightFrameIndex(action: KnightAction, facing: IsoFacing4): number {
  const row = ACTION_ROW[action];
  const col = FACING_COL[facing];
  return row * 4 + col;
}

export function knightAnimKey(action: KnightAction, facing: IsoFacing4): string {
  return `${GEN_KNIGHT_SHEET_KEY}:${action}:${facing}`;
}

/**
 * Convert a tile-to-tile vector into one of the 4 diagonal isometric facings.
 * Uses screen-space delta so it stays correct if your iso projection changes.
 */
export function isoFacingFromTiles(cfg: BoardConfig, from: TileCoord, to: TileCoord): IsoFacing4 {
  const a = isoToScreen(from.x, from.y, cfg);
  const b = isoToScreen(to.x, to.y, cfg);
  const dx = b.sx - a.sx;
  const dy = b.sy - a.sy;

  // Screen-space quadrants:
  //  - dx>=0, dy>=0 => SE
  //  - dx<0,  dy>=0 => SW
  //  - dx<0,  dy<0  => NW
  //  - dx>=0, dy<0  => NE
  if (dx >= 0 && dy >= 0) return "SE";
  if (dx < 0 && dy >= 0) return "SW";
  if (dx < 0 && dy < 0) return "NW";
  return "NE";
}

export function oppositeFacing(f: IsoFacing4): IsoFacing4 {
  switch (f) {
    case "SW":
      return "NE";
    case "NE":
      return "SW";
    case "NW":
      return "SE";
    case "SE":
      return "NW";
  }
}

/**
 * Simple, fixed durations (ms) for one-shot actions.
 * This first-pass sheet is 1-frame-per-action, so durations are purely for feel.
 */
export function actionDurationMs(action: Exclude<KnightAction, "idle" | "walk">): number {
  switch (action) {
    case "attack":
      return 220;
    case "hit":
      return 160;
    case "block":
      return 160;
    case "death":
      return 420;
  }
}
