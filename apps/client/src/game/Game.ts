import Phaser from "phaser";
import { BoardScene } from "./scenes/BoardScene";

export function createGame() {
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: 1100,
    height: 700,
    parent: "app",
    backgroundColor: "#000000",
    scene: [BoardScene],
  });
}