import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";

export function createGame() {
  const parent = document.getElementById("app");
  const w = parent?.clientWidth ?? window.innerWidth;
  const h = parent?.clientHeight ?? window.innerHeight;

  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: "app",
    backgroundColor: "#000000",

    // Initial size (will be resized to parent immediately)
    width: w,
    height: h,

    // Make the canvas always match the parent element size
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },

    scene: [BoardScene],
  });
}
