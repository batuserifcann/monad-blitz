export type GameStatus = "waiting" | "countdown" | "active" | "ended";

export interface Tank {
  id: string;
  address: string;
  x: number;
  y: number;
  rotation: number;
  hp: number;
  ammo: number;
  monBalance: string;
  attackPower: number;
  alive: boolean;
  speed: number;
}

export interface Bullet {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  age: number;
}

export interface PlayerKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
}

export interface PlayerInputMessage {
  gameId: string;
  keys: PlayerKeys;
  aimAngle: number;
}

export interface JoinGameMessage {
  gameId: string;
  playerAddress: string;
}

export interface GameStatePayload {
  tanks: Tank[];
  bullets: Bullet[];
  gameStatus: GameStatus;
  countdownSeconds?: number;
}

export interface PlayerKilledPayload {
  killer: string;
  victim: string;
  monTransferred: string;
}

export interface GameEndedPayload {
  winner: string;
  winnerPayout: string;
  ownerPayout: string;
}

export type TxConfirmedType =
  | "createGame"
  | "startGame"
  | "recordKill"
  | "endGame";

export interface TxConfirmedPayload {
  type: TxConfirmedType;
  txHash: string;
  from: string;
  to: string;
  gameId: string;
  timestamp: number;
}

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
export const TANK_RADIUS = 20;
export const BULLET_RADIUS = 5;
