import Phaser from "phaser";
import { gameViewBridge } from "./bridge";
import { BULLET_RADIUS, TANK_RADIUS } from "../types";

const TANK_COLORS = [0x22ff66, 0xff3344, 0x4488ff, 0xffdd22, 0xaa44ff];
const DEAD_ALPHA = 0.35;
const HP_BAR_W = 40;
const HP_BAR_H = 4;
const HP_BG = 0x2a2a2a;

function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hpBarFg(hp: number): number {
  if (hp > 50) return 0x22ff66;
  if (hp > 25) return 0xffdd22;
  return 0xff3344;
}

export class TankScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private pointLabels = new Map<string, Phaser.GameObjects.Text>();
  private bg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: "TankScene" });
  }

  create(): void {
    // Input is handled by the DOM (page.tsx); Phaser must not capture keys/pointer.
    const kb = this.input.keyboard;
    if (kb) kb.enabled = false;
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.style.pointerEvents = "none";
    }

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
      for (const t of this.pointLabels.values()) t.destroy();
      this.pointLabels.clear();
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

      const barTop = cy - half - 34;
      const barLeft = cx - HP_BAR_W / 2;
      this.g.fillStyle(HP_BG, alpha);
      this.g.fillRect(barLeft, barTop, HP_BAR_W, HP_BAR_H);
      const hpFrac = Math.max(0, Math.min(1, tank.hp / 100));
      const fg = tank.alive ? hpBarFg(tank.hp) : 0x555555;
      this.g.fillStyle(fg, alpha);
      this.g.fillRect(barLeft, barTop, HP_BAR_W * hpFrac, HP_BAR_H);

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
      text.setPosition(cx, cy - half - 22);
      text.setStyle({ color: tank.alive ? "#ccffcc" : "#888888" });
      let pts = this.pointLabels.get(tank.id);
      if (!pts) {
        pts = this.add.text(0, 0, "", {
          fontSize: "9px",
          color: "#99aa99",
          fontFamily: "ui-monospace, monospace",
        });
        pts.setOrigin(0.5, 1);
        this.pointLabels.set(tank.id, pts);
      }
      pts.setText(`${tank.points} pts`);
      pts.setPosition(cx, cy - half - 8);
      pts.setStyle({ color: tank.alive ? "#88cc88" : "#666666" });
    });

    for (const [id, text] of this.labels) {
      if (!seen.has(id)) {
        text.destroy();
        this.labels.delete(id);
      }
    }
    for (const [id, text] of this.pointLabels) {
      if (!seen.has(id)) {
        text.destroy();
        this.pointLabels.delete(id);
      }
    }

    snap.bullets.forEach((b) => {
      this.g.fillStyle(0xffee88, 1);
      this.g.fillCircle(b.x, b.y, BULLET_RADIUS);
    });
  }
}
