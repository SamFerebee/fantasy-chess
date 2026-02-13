import Phaser from "phaser";
import { getAllUnitSpriteKeys } from "../units/UnitCatalog";

/**
 * Minimal unit asset loader.
 *
 * Convention:
 * - Put unit PNGs at: public/assets/units/<spriteKey>.png
 * - Example: public/assets/units/unit_scout.png
 *
 * The renderer will fall back to placeholder shapes if a texture is missing.
 */
export function preloadUnitAssets(scene: Phaser.Scene, opts?: { basePath?: string; ext?: string }) {
  const basePath = opts?.basePath ?? "assets/units";
  const ext = opts?.ext ?? "png";

  const keys = getAllUnitSpriteKeys();
  for (const key of keys) {
    // Avoid double-queueing the same key.
    if (scene.textures.exists(key)) continue;
    scene.load.image(key, `${basePath}/${key}.${ext}`);
  }
}
