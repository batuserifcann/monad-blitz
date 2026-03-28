import { getAddress } from "ethers";
import type { Server, Socket } from "socket.io";
import type { ContractService } from "../blockchain/ContractService.js";
import type { JoinGameMessage, PlayerInputMessage } from "../types.js";
import { GameState } from "./GameState.js";

export class GameManager {
  private readonly games = new Map<string, GameState>();
  private readonly countdownTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly io: Server;
  private readonly contractService: ContractService;

  constructor(io: Server, contractService: ContractService) {
    this.io = io;
    this.contractService = contractService;
  }

  async createGameFromApi(): Promise<{ gameId: string }> {
    const gameId = await this.contractService.createGame();
    const key = gameId.toString();
    const room = `game:${key}`;
    const gs = new GameState(
      BigInt(gameId),
      this.io,
      this.contractService,
      room,
      () => this.cleanupGame(key)
    );
    this.games.set(key, gs);
    return { gameId: key };
  }

  getGame(gameId: string): GameState | undefined {
    return this.games.get(gameId);
  }

  async getGameInfoForApi(gameId: string): Promise<{
    status: number;
    playerCount: string;
    prizePool: string;
    protocolPoints: string;
    playersOnChain: string[];
    serverLobbyPlayers: number;
    serverStatus?: string;
  }> {
    const id = BigInt(gameId);
    const info = await this.contractService.getGameInfo(id);
    const playersOnChain = await this.contractService.getPlayerList(id);
    const mem = this.games.get(gameId);
    return {
      status: info.status,
      playerCount: info.playerCount,
      prizePool: info.prizePool,
      protocolPoints: info.protocolPoints,
      playersOnChain,
      serverLobbyPlayers: mem?.getTankCount() ?? 0,
      serverStatus: mem?.gameStatus,
    };
  }

  async handleJoin(socket: Socket, raw: JoinGameMessage): Promise<void> {
    let playerAddress: string;
    try {
      playerAddress = getAddress(raw.playerAddress);
    } catch {
      socket.emit("error", { message: "Invalid player address" });
      return;
    }

    const gameId = raw.gameId?.trim();
    if (!gameId) {
      socket.emit("error", { message: "gameId required" });
      return;
    }

    const gs = this.games.get(gameId);
    if (!gs) {
      socket.emit("error", { message: "Game not found" });
      return;
    }

    if (gs.hasPlayerAddress(playerAddress)) {
      socket.emit("error", { message: "Address already in this game" });
      return;
    }

    if (gs.gameStatus === "ended") {
      socket.emit("error", { message: "Game already ended" });
      return;
    }

    try {
      const p = await this.contractService.getPlayer(BigInt(gameId), playerAddress);
      if (!p.joined) {
        socket.emit("error", { message: "Player not registered on-chain for this game" });
        return;
      }
    } catch (e) {
      console.error("[GameManager] getPlayer", e);
      socket.emit("error", { message: "Could not verify player on-chain" });
      return;
    }

    const room = gs.room;
    await socket.join(room);

    gs.addPlayer(socket.id, playerAddress);
    socket.data.gameId = gameId;
    socket.data.playerAddress = playerAddress;

    gs.tryStartCountdownIfReady();

    if (gs.gameStatus === "countdown" && gs.countdownEnd !== null) {
      const existing = this.countdownTimers.get(gameId);
      if (existing) {
        clearTimeout(existing);
      }
      const delay = Math.max(0, gs.countdownEnd - Date.now());
      const timer = setTimeout(() => {
        void this.startBattle(gameId);
      }, delay);
      this.countdownTimers.set(gameId, timer);
    }

    gs.broadcastState();
  }

  handleInput(socket: Socket, raw: PlayerInputMessage): void {
    const gameId = socket.data.gameId as string | undefined;
    if (!gameId) return;
    const gs = this.games.get(gameId);
    if (!gs || gs.gameStatus !== "active") return;
    if (raw.gameId !== gameId) return;
    gs.setInput(socket.id, raw);
  }

  handleDisconnect(socket: Socket): void {
    const gameId = socket.data.gameId as string | undefined;
    if (!gameId) return;
    const gs = this.games.get(gameId);
    if (!gs) return;
    gs.removePlayer(socket.id);
    gs.broadcastState();
  }

  private async startBattle(gameId: string): Promise<void> {
    this.countdownTimers.delete(gameId);
    const gs = this.games.get(gameId);
    if (!gs || gs.gameStatus !== "countdown") return;

    try {
      await this.contractService.startGame(BigInt(gameId));
    } catch (e) {
      console.error("[GameManager] startGame", e);
      this.io.to(gs.room).emit("error", { message: "startGame failed" });
      return;
    }

    gs.onCountdownElapsed();
    gs.beginActive();
    this.io.to(gs.room).emit("game-started", { gameId });
  }

  private cleanupGame(gameId: string): void {
    const t = this.countdownTimers.get(gameId);
    if (t) clearTimeout(t);
    this.countdownTimers.delete(gameId);
    this.games.delete(gameId);
  }
}
