import type { Server } from "socket.io";
import { BULLET_RADIUS, bulletHitsTank, inArena, TANK_RADIUS } from "./Physics.js";
import type {
  Bullet,
  GameStatePayload,
  GameStatus,
  PlayerInputMessage,
  Tank,
} from "../types.js";
import type { ContractService } from "../blockchain/ContractService.js";

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
const TICK_MS = Math.floor(1000 / 30);
const BULLET_SPEED = 8;
const SHOT_COOLDOWN_MS = 200;
const MIN_ATTACK_POWER = 25;
const ATTACK_GAIN_ON_HIT = 25;
const ATTACK_LOSS_ON_MISS = 25;
const AMMO_PACK_COST = 10;
const AMMO_PACK_SIZE = 10;

const SPAWNS: [number, number][] = [
  [120, 300],
  [680, 300],
  [400, 120],
  [400, 480],
  [250, 450],
];

export class GameState {
  readonly gameId: bigint;
  readonly room: string;
  private readonly io: Server;
  private readonly contractService: ContractService;
  private readonly onEnded: () => void;

  private tanks = new Map<string, Tank>();
  private bullets: Bullet[] = [];
  private nextBulletId = 1;
  private inputs = new Map<string, PlayerInputMessage>();
  private lastShootAt = new Map<string, number>();
  private shootWasDown = new Map<string, boolean>();

  gameStatus: GameStatus = "waiting";
  protocolPoints = 0;
  countdownEnd: number | null = null;
  private countdownStarting = false;

  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private ended = false;
  private tickCounter = 0;

  constructor(
    gameId: bigint,
    io: Server,
    contractService: ContractService,
    room: string,
    onEnded: () => void
  ) {
    this.gameId = gameId;
    this.io = io;
    this.contractService = contractService;
    this.room = room;
    this.onEnded = onEnded;
    this.tickHandle = setInterval(() => this.tick(), TICK_MS);
  }

  beginCountdown(endAt: number): void {
    this.gameStatus = "countdown";
    this.countdownEnd = endAt;
  }

  beginActive(): void {
    this.gameStatus = "active";
  }

  stop(): void {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  addPlayer(socketId: string, address: string): void {
    const idx = this.tanks.size;
    const spawn = SPAWNS[idx % SPAWNS.length]!;
    const tank: Tank = {
      id: socketId,
      address,
      x: spawn[0],
      y: spawn[1],
      rotation: 0,
      hp: 100,
      ammo: 20,
      points: 100,
      attackPower: 100,
      alive: true,
      speed: 5,
    };
    this.tanks.set(socketId, tank);
  }

  removePlayer(socketId: string): void {
    this.tanks.delete(socketId);
    this.inputs.delete(socketId);
    this.lastShootAt.delete(socketId);
    this.shootWasDown.delete(socketId);
  }

  setInput(socketId: string, msg: PlayerInputMessage): void {
    this.inputs.set(socketId, msg);
  }

  getTankCount(): number {
    return this.tanks.size;
  }

  hasPlayerAddress(address: string): boolean {
    const a = address.toLowerCase();
    return [...this.tanks.values()].some(
      (tank) => tank.address.toLowerCase() === a
    );
  }


  getSnapshot(): GameStatePayload {
    let countdownSeconds: number | undefined;
    if (this.gameStatus === "countdown" && this.countdownEnd !== null) {
      countdownSeconds = Math.max(
        0,
        Math.ceil((this.countdownEnd - Date.now()) / 1000)
      );
    }
    return {
      tanks: [...this.tanks.values()],
      bullets: this.bullets,
      gameStatus: this.gameStatus,
      protocolPoints: this.protocolPoints,
      countdownSeconds,
    };
  }

  broadcastState(): void {
    this.io.to(this.room).emit("game-state", this.getSnapshot());
  }

  private tick(): void {
    if (this.ended) return;

    this.tickCounter += 1;
    if (this.tickCounter % 100 === 0) {
      console.log("[GameState] tick", this.tickCounter, {
        gameId: String(this.gameId),
        status: this.gameStatus,
        inputSockets: this.inputs.size,
        tanks: this.tanks.size,
      });
    }

    if (this.gameStatus === "active") {
      this.simulateTick();
    }

    this.broadcastState();
  }

  private simulateTick(): void {
    const now = Date.now();

    for (const [id, tank] of this.tanks) {
      if (!tank.alive) continue;
      const input = this.inputs.get(id);
      if (!input) continue;

      const { keys, aimAngle } = input;
      tank.rotation = aimAngle;

      const forward = (keys.up ? 1 : 0) + (keys.down ? -1 : 0);
      const strafe = (keys.right ? 1 : 0) + (keys.left ? -1 : 0);
      const ang = aimAngle;

      const fx = Math.cos(ang) * tank.speed * forward;
      const fy = Math.sin(ang) * tank.speed * forward;
      const sx = Math.cos(ang - Math.PI / 2) * tank.speed * strafe;
      const sy = Math.sin(ang - Math.PI / 2) * tank.speed * strafe;

      tank.x += fx + sx;
      tank.y += fy + sy;

      tank.x = Math.max(TANK_RADIUS, Math.min(ARENA_WIDTH - TANK_RADIUS, tank.x));
      tank.y = Math.max(TANK_RADIUS, Math.min(ARENA_HEIGHT - TANK_RADIUS, tank.y));

      const wasDown = this.shootWasDown.get(id) ?? false;
      const down = keys.shoot;
      const edge = down && !wasDown;
      this.shootWasDown.set(id, down);

      if (edge) {
        const last = this.lastShootAt.get(id) ?? 0;
        if (now - last >= SHOT_COOLDOWN_MS) {
          let boughtAmmo = false;
          if (tank.ammo === 0 && tank.points >= AMMO_PACK_COST) {
            tank.points -= AMMO_PACK_COST;
            tank.ammo += AMMO_PACK_SIZE;
            boughtAmmo = true;
            this.io.to(this.room).emit("ammo-purchased", {
              gameId: this.gameId.toString(),
              playerAddress: tank.address,
              remainingPoints: tank.points,
            });
            void this.contractService.buyAmmo(this.gameId, tank.address);
          }
          if (tank.ammo > 0 && tank.points >= 1) {
            this.lastShootAt.set(id, now);
            tank.ammo -= 1;
            tank.points -= 1;
            this.protocolPoints += 1;

            const bx = tank.x + Math.cos(ang) * (TANK_RADIUS + BULLET_RADIUS + 2);
            const by = tank.y + Math.sin(ang) * (TANK_RADIUS + BULLET_RADIUS + 2);
            const dx = Math.cos(ang) * BULLET_SPEED;
            const dy = Math.sin(ang) * BULLET_SPEED;

            this.bullets.push({
              id: `b-${this.nextBulletId++}`,
              ownerId: id,
              x: bx,
              y: by,
              dx,
              dy,
              speed: BULLET_SPEED,
              age: 0,
            });
          } else if (boughtAmmo) {
            this.lastShootAt.set(id, now);
          }
        }
      }
    }

    const remaining: Bullet[] = [];
    for (const bullet of this.bullets) {
      bullet.x += bullet.dx;
      bullet.y += bullet.dy;
      bullet.age += 1;

      const owner = this.tanks.get(bullet.ownerId);
      if (!owner) continue;

      let hit: Tank | null = null;
      for (const tank of this.tanks.values()) {
        if (!tank.alive) continue;
        if (bullet.age < 8 && tank.id === bullet.ownerId) continue;
        if (bulletHitsTank(bullet.x, bullet.y, tank.x, tank.y)) {
          hit = tank;
          break;
        }
      }

      if (hit) {
        const shooter = this.tanks.get(bullet.ownerId);
        if (shooter && shooter.alive) {
          const damage = Math.floor(shooter.attackPower / 10);
          hit.hp -= damage;
          shooter.attackPower = Math.min(65535, shooter.attackPower + ATTACK_GAIN_ON_HIT);
          if (hit.hp <= 0) {
            this.applyKill(shooter, hit);
          }
        }
        continue;
      }

      if (
        !inArena(bullet.x, bullet.y, ARENA_WIDTH, ARENA_HEIGHT) ||
        bullet.x < -BULLET_RADIUS ||
        bullet.x > ARENA_WIDTH + BULLET_RADIUS ||
        bullet.y < -BULLET_RADIUS ||
        bullet.y > ARENA_HEIGHT + BULLET_RADIUS
      ) {
        const shooter = this.tanks.get(bullet.ownerId);
        if (shooter && shooter.alive) {
          shooter.attackPower = Math.max(
            MIN_ATTACK_POWER,
            shooter.attackPower - ATTACK_LOSS_ON_MISS
          );
        }
        continue;
      }

      remaining.push(bullet);
    }
    this.bullets = remaining;

    const alive = [...this.tanks.values()].filter((t) => t.alive);
    if (!this.ended && this.gameStatus === "active" && alive.length === 1) {
      void this.finishWithWinner(alive[0]!);
    }
  }

  private applyKill(killer: Tank, victim: Tank): void {
    const transferred = victim.points;
    killer.points += victim.points;
    victim.points = 0;
    victim.hp = 0;
    victim.alive = false;

    this.io.to(this.room).emit("player-killed", {
      killer: killer.address,
      victim: victim.address,
      pointsTransferred: transferred,
    });

    void this.contractService.recordKill(
      this.gameId,
      killer.address,
      victim.address
    );

    const survivors = [...this.tanks.values()].filter((t) => t.alive);
    if (survivors.length === 1) {
      void this.finishWithWinner(survivors[0]!);
    }
  }

  private async finishWithWinner(winner: Tank): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    this.gameStatus = "ended";
    this.stop();

    const winnerPoints = BigInt(Math.floor(winner.points));

    try {
      const payouts = await this.contractService.endGame(
        this.gameId,
        winner.address,
        winnerPoints
      );
      this.io.to(this.room).emit("game-ended", {
        winner: winner.address,
        winnerPayout: payouts.winnerPayout.toString(),
        ownerPayout: payouts.ownerPayout.toString(),
      });
    } catch (e) {
      console.error("[GameState] endGame failed", e);
      this.io.to(this.room).emit("error", { message: "endGame transaction failed" });
    } finally {
      this.onEnded();
    }
  }

  tryStartCountdownIfReady(): void {
    if (this.gameStatus !== "waiting") return;
    if (this.tanks.size < 2) return;
    if (this.countdownStarting) return;
    this.countdownStarting = true;
    const end = Date.now() + 10_000;
    this.beginCountdown(end);
  }

  onCountdownElapsed(): void {
    this.countdownStarting = false;
  }
}
