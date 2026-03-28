import Phaser from "phaser";
import { formatEther } from "ethers";
import { gameViewBridge } from "./bridge";
import { BULLET_RADIUS, TANK_RADIUS } from "../types";

/* ── colour palette ──────────────────────────────────────────────── */
const TANK_COLORS = [0x22ff66, 0xff3344, 0x4488ff, 0xffdd22, 0xaa44ff];
const TANK_BODY_SHADES = [0x18b84a, 0xcc2233, 0x3366cc, 0xccaa11, 0x8833cc]; // darker
const DEAD_ALPHA = 0.35;
const HP_BAR_W = 40;
const HP_BAR_H = 4;
const HP_BG = 0x2a2a2a;

/* obstacles — crate / bunker */
const OB_FILL = 0x1a1d1a;
const OB_EDGE = 0x2a3228;
const OB_PANEL = 0x3d4a3a;

/* ── helpers ──────────────────────────────────────────────────────── */
function truncateAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hpBarFg(hp: number): number {
  if (hp > 50) return 0x22ff66;
  if (hp > 25) return 0xffdd22;
  return 0xff3344;
}

function colorToStr(c: number): string {
  return "#" + c.toString(16).padStart(6, "0");
}

/* ── confetti particle ───────────────────────────────────────────── */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: number;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
}

export class TankScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private labels = new Map<string, Phaser.GameObjects.Text>();
  private pointLabels = new Map<string, Phaser.GameObjects.Text>();
  private bg!: Phaser.GameObjects.Rectangle;

  /* bullet trail history: bulletId → last N positions */
  private bulletTrails = new Map<string, { x: number; y: number }[]>();
  private static readonly TRAIL_LEN = 4;

  /* game-over particles / effects */
  private confetti: Particle[] = [];
  private shakeTimer = 0;
  private redFlashAlpha = 0;
  private prevGameOverState: string | null = null;
  private glowPulse = 0;

  constructor() {
    super({ key: "TankScene" });
  }

  create(): void {
    const kb = this.input.keyboard;
    if (kb) kb.enabled = false;
    const canvas = this.game.canvas;
    if (canvas) canvas.style.pointerEvents = "none";

    this.g = this.add.graphics();
    this.bg = this.add
      .rectangle(0, 0, 800, 600, 0x0a0d0a, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(2, 0x22ff66, 0.6);
    this.bg.setDepth(-1);
  }

  /* ── main render loop ────────────────────────────────────────── */
  update(_time: number, delta: number): void {
    const snap = gameViewBridge.snapshot;
    const myId = gameViewBridge.myTankId;
    const gameOver = gameViewBridge.gameOverState;
    this.g.clear();

    this.glowPulse = (this.glowPulse + delta * 0.003) % (Math.PI * 2);

    if (!snap) {
      for (const t of this.labels.values()) t.destroy();
      this.labels.clear();
      for (const t of this.pointLabels.values()) t.destroy();
      this.pointLabels.clear();
      return;
    }

    /* ── game-over effects trigger ── */
    if (gameOver && gameOver !== this.prevGameOverState) {
      if (gameOver === "win") this.spawnConfetti();
      if (gameOver === "lose") {
        this.shakeTimer = 500; // ms
        this.redFlashAlpha = 0.35;
      }
    }
    this.prevGameOverState = gameOver ?? null;

    /* ── obstacles (behind tanks) ── */
    const obstacles = snap.obstacles ?? [];
    for (const o of obstacles) {
      this.g.fillStyle(OB_FILL, 1);
      this.g.fillRect(o.x, o.y, o.w, o.h);
      this.g.lineStyle(1.5, OB_EDGE, 0.95);
      this.g.strokeRect(o.x, o.y, o.w, o.h);
      this.g.lineStyle(1, OB_PANEL, 0.55);
      const inset = 3;
      this.g.strokeRect(o.x + inset, o.y + inset, o.w - inset * 2, o.h - inset * 2);
      this.g.beginPath();
      this.g.moveTo(o.x + inset, o.y + o.h * 0.35);
      this.g.lineTo(o.x + o.w - inset, o.y + o.h * 0.35);
      this.g.moveTo(o.x + inset, o.y + o.h * 0.65);
      this.g.lineTo(o.x + o.w - inset, o.y + o.h * 0.65);
      this.g.strokePath();
      this.g.beginPath();
      this.g.moveTo(o.x + o.w * 0.35, o.y + inset);
      this.g.lineTo(o.x + o.w * 0.35, o.y + o.h - inset);
      this.g.moveTo(o.x + o.w * 0.65, o.y + inset);
      this.g.lineTo(o.x + o.w * 0.65, o.y + o.h - inset);
      this.g.strokePath();
    }

    /* ── draw tanks ── */
    const seen = new Set<string>();
    snap.tanks.forEach((tank, index) => {
      seen.add(tank.id);
      const color = TANK_COLORS[index % TANK_COLORS.length]!;
      const bodyShade = TANK_BODY_SHADES[index % TANK_BODY_SHADES.length]!;
      const bodyColor = tank.alive ? color : 0x555555;
      const rimColor = tank.alive ? bodyShade : 0x444444;
      const alpha = tank.alive ? 1 : DEAD_ALPHA;
      const cx = tank.x;
      const cy = tank.y;
      const r = TANK_RADIUS;
      const ang = tank.rotation;

      /* glow for current player */
      if (tank.alive && tank.id === myId) {
        const glowAlpha = 0.08 + Math.sin(this.glowPulse) * 0.04;
        for (let ring = 3; ring >= 1; ring--) {
          this.g.fillStyle(color, glowAlpha);
          this.g.fillCircle(cx, cy, r + ring * 6);
        }
      }

      /* tracks (two dark strips) */
      const trackW = 5;
      const trackH = r * 1.8;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const perpX = -sin;
      const perpY = cos;
      const trackOffset = r * 0.85;
      this.g.fillStyle(0x1a1a1a, alpha);
      for (const side of [-1, 1]) {
        const ox = cx + perpX * trackOffset * side;
        const oy = cy + perpY * trackOffset * side;
        this.g.save();
        this.g.fillRect(ox - trackW / 2, oy - trackH / 2, trackW, trackH);
        this.g.restore();
      }

      /* body (rounded rect via filled circle + rect) */
      this.g.fillStyle(bodyColor, alpha);
      this.g.fillRoundedRect(cx - r, cy - r * 0.7, r * 2, r * 1.4, 5);
      this.g.lineStyle(1.5, rimColor, alpha);
      this.g.strokeRoundedRect(cx - r, cy - r * 0.7, r * 2, r * 1.4, 5);

      /* turret base (small circle) */
      const turretBaseR = 7;
      this.g.fillStyle(tank.alive ? 0xdddddd : 0x777777, alpha);
      this.g.fillCircle(cx, cy, turretBaseR);
      this.g.lineStyle(1, rimColor, alpha);
      this.g.strokeCircle(cx, cy, turretBaseR);

      /* turret barrel (longer line) */
      const barrelLen = r + 16;
      const bx = cx + Math.cos(ang) * barrelLen;
      const by = cy + Math.sin(ang) * barrelLen;
      this.g.lineStyle(4, tank.alive ? 0xdddddd : 0x888888, alpha);
      this.g.beginPath();
      this.g.moveTo(cx + Math.cos(ang) * turretBaseR, cy + Math.sin(ang) * turretBaseR);
      this.g.lineTo(bx, by);
      this.g.strokePath();
      /* barrel tip */
      this.g.fillStyle(tank.alive ? 0xffffff : 0x999999, alpha);
      this.g.fillCircle(bx, by, 2.5);

      /* dead "X" overlay */
      if (!tank.alive) {
        this.g.lineStyle(3, 0xff3344, 0.7);
        this.g.beginPath();
        this.g.moveTo(cx - r * 0.5, cy - r * 0.5);
        this.g.lineTo(cx + r * 0.5, cy + r * 0.5);
        this.g.strokePath();
        this.g.beginPath();
        this.g.moveTo(cx + r * 0.5, cy - r * 0.5);
        this.g.lineTo(cx - r * 0.5, cy + r * 0.5);
        this.g.strokePath();
      }

      /* HP bar */
      const barTop = cy - r - 34;
      const barLeft = cx - HP_BAR_W / 2;
      this.g.fillStyle(HP_BG, alpha);
      this.g.fillRect(barLeft, barTop, HP_BAR_W, HP_BAR_H);
      const hpFrac = Math.max(0, Math.min(1, tank.hp / 100));
      const fg = tank.alive ? hpBarFg(tank.hp) : 0x555555;
      this.g.fillStyle(fg, alpha);
      this.g.fillRect(barLeft, barTop, HP_BAR_W * hpFrac, HP_BAR_H);

      /* address label */
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
      text.setPosition(cx, cy - r - 22);
      text.setStyle({ color: tank.alive ? "#ccffcc" : "#888888" });

      /* points label */
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
      try {
        pts.setText(`${Number(formatEther(tank.monBalance)).toFixed(2)} MON`);
      } catch {
        pts.setText("— MON");
      }
      pts.setPosition(cx, cy - r - 8);
      pts.setStyle({ color: tank.alive ? "#88cc88" : "#666666" });
    });

    /* cleanup stale labels */
    for (const [id, text] of this.labels) {
      if (!seen.has(id)) { text.destroy(); this.labels.delete(id); }
    }
    for (const [id, text] of this.pointLabels) {
      if (!seen.has(id)) { text.destroy(); this.pointLabels.delete(id); }
    }

    /* ── bullet trails + bullets ── */
    const activeBullets = new Set<string>();
    snap.bullets.forEach((b) => {
      activeBullets.add(b.id);

      /* store trail */
      let trail = this.bulletTrails.get(b.id);
      if (!trail) { trail = []; this.bulletTrails.set(b.id, trail); }
      trail.push({ x: b.x, y: b.y });
      if (trail.length > TankScene.TRAIL_LEN) trail.shift();

      /* find shooter color */
      let bulletColor = 0xffee88;
      const ownerIdx = snap.tanks.findIndex((t) => t.id === b.ownerId);
      if (ownerIdx >= 0) bulletColor = TANK_COLORS[ownerIdx % TANK_COLORS.length]!;

      /* draw trail (oldest→newest, fading) */
      for (let i = 0; i < trail.length - 1; i++) {
        const pt = trail[i]!;
        const frac = (i + 1) / trail.length;
        this.g.fillStyle(bulletColor, frac * 0.35);
        this.g.fillCircle(pt.x, pt.y, BULLET_RADIUS * frac);
      }

      /* main bullet */
      this.g.fillStyle(0xffee88, 1);
      this.g.fillCircle(b.x, b.y, BULLET_RADIUS);
      /* bullet glow */
      this.g.fillStyle(0xffee88, 0.15);
      this.g.fillCircle(b.x, b.y, BULLET_RADIUS * 2);
    });

    /* prune trails for disappeared bullets */
    for (const id of this.bulletTrails.keys()) {
      if (!activeBullets.has(id)) this.bulletTrails.delete(id);
    }

    /* ── confetti ── */
    this.updateConfetti(delta);

    /* ── screen shake ── */
    if (this.shakeTimer > 0) {
      this.shakeTimer -= delta;
      const intensity = Math.min(this.shakeTimer / 500, 1) * 4;
      this.cameras.main.setScroll(
        (Math.random() - 0.5) * intensity * 2,
        (Math.random() - 0.5) * intensity * 2
      );
      if (this.shakeTimer <= 0) this.cameras.main.setScroll(0, 0);
    }

    /* ── red flash (lose) ── */
    if (this.redFlashAlpha > 0) {
      this.g.fillStyle(0xff0000, this.redFlashAlpha);
      this.g.fillRect(0, 0, 800, 600);
      this.redFlashAlpha -= delta * 0.0005;
      if (this.redFlashAlpha < 0) this.redFlashAlpha = 0;
    }
  }

  /* ── confetti helpers ──────────────────────────────────────────── */
  private spawnConfetti(): void {
    const colors = [0x22ff66, 0xffd700, 0x44ffaa, 0xffee44, 0x88ff88];
    for (let i = 0; i < 60; i++) {
      this.confetti.push({
        x: 400 + (Math.random() - 0.5) * 300,
        y: 50 + Math.random() * 100,
        vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 1.5 + 0.5,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        size: 3 + Math.random() * 4,
        life: 0,
        maxLife: 2500 + Math.random() * 1000,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.1,
      });
    }
  }

  private updateConfetti(delta: number): void {
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i]!;
      p.life += delta;
      if (p.life > p.maxLife) { this.confetti.splice(i, 1); continue; }
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.02;
      p.rotation += p.rotSpeed;
      const fading = 1 - p.life / p.maxLife;
      this.g.fillStyle(p.color, fading * 0.85);
      this.g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size * 0.6);
    }
  }
}
