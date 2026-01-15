import "./style.css";
import Phaser from "phaser";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  parent: "app",
  backgroundColor: "#1e1e1e",
  scene: {
    create() {
      const { width, height } = this.scale;
      this.add
        .text(width / 2, height / 2, "Phaser is running", {
          fontFamily: "system-ui, sans-serif",
          fontSize: "48px",
          color: "#ffffff",
        })
        .setOrigin(0.5);
    },
  },
};

new Phaser.Game(config);
