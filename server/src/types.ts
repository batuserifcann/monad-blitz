export type GameStatus = "waiting" | "countdown" | "active" | "ended";

export interface Tank {
  id: string;
  address: string;
  x: number;
  y: number;
  rotation: number;
  hp: number;
  ammo: number;
  points: number;
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
  protocolPoints: number;
  countdownSeconds?: number;
}

export interface PlayerKilledPayload {
  killer: string;
  victim: string;
  pointsTransferred: number;
}

export interface GameEndedPayload {
  winner: string;
  winnerPayout: string;
  ownerPayout: string;
}
