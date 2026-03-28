import Phaser from "phaser";
import { gameViewBridge } from "./bridge";
import { BULLET_RADIUS, TANK_RADIUS } from "../types";

const TANK_COLORS = [0x22ff66, 0xff3344, 0x4488ff, 0xffdd22, 0xaa44ff];
const DEAD_ALPHA = 0.35;

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export class TankScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private bg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "TankScene" });
  }

  create(): void {
    this.g = this.add.graphics();
    this.bg = this.add
      .rectangle(0, 0, 800, 600, 0x0a0d0a, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x22ff66, 0.6);
    this.bg.setDepth(-1);
  }

  update(): void {
    const snap = gameViewBridge.snapshot;
    const myId = gameViewBridge.myTankId;
    this.g.clear();

    if (!snap) {
      for (const t of this.labels.values()) t.destroy();
      this.labels.clear();
      return;
    }

    const seen = new Set<string>();
    snap.tanks.forEach((tank, index) => {
      seen.add(tank.id);
      const color = TANK_COLORS[index % TANK_COLORS.length]!;
      const bodyColor = tank.alive ? color : 0x666666;
      const alpha = tank.alive ? 1 : DEAD_ALPHA;
      const cx = tank.x;
      const cy = tank.y;
      const half = TANK_RADIUS;

      this.g.fillStyle(bodyColor, alpha);
      this.g.fillRect(cx - half, cy - half, half * 2, half * 2);

      if (tank.alive && tank.id === myId) {
        this.g.lineStyle(3, 0xffffff, 1);
        this.g.strokeRect(cx - half - 2, cy - half - 2, half * 2 + 4, half * 2 + 4);
      }

      const ang = tank.rotation;
      const len = TANK_RADIUS + 12;
      const tx = cx + Math.cos(ang) * len;
      const ty = cy + Math.sin(ang) * len;
      this.g.lineStyle(3, tank.alive ? 0xffffff : 0x888888, alpha);
      this.g.beginPath();
      this.g.moveTo(cx, cy);
      this.g.lineTo(tx, ty);
      this.g.strokePath();

      let text = this.labels.get(tank.id);
      if (!text) {
        text = this.add.text(0, 0, "", {
          fontSize: "11px",
          color: "#ccffcc",
          fontFamily: "ui-monospace, monospace",
        });
        text.setOrigin(0.5, 1);
        this.labels.set(tank.id, text);
      }
      text.setText(truncateAddress(tank.address));
      text.setPosition(cx, cy - half - 14);
      text.setStyle({ color: tank.alive ? "#ccffcc" : "#888888" });
    });

    for (const [id, text] of this.labels) {
      if (!seen.has(id)) {
        text.destroy();
        this.labels.delete(id);
      }
    }

    snap.bullets.forEach((b) => {
      this.g.fillStyle(0xffee88, 1);
      this.g.fillCircle(b.x, b.y, BULLET_RADIUS);
    });
  }
}
