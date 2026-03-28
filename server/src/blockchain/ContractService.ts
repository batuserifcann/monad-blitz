import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { Server } from "socket.io";
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  type ContractTransactionReceipt,
  type InterfaceAbi,
} from "ethers";
import type { TxConfirmedPayload } from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadAbi(): InterfaceAbi {
  const artifactPath = path.join(__dirname, "abi", "TankBlitz.json");
  const raw = fs.readFileSync(artifactPath, "utf8");
  const parsed = JSON.parse(raw) as { abi: InterfaceAbi };
  return parsed.abi;
}

export class TxQueue {
  private chain: Promise<unknown> = Promise.resolve();

  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.chain.then(() => fn());
    this.chain = next.then(
      () => undefined,
      (err: unknown) => {
        console.error("[tx-queue]", err);
      }
    );
    return next;
  }
}

export class ContractService {
  readonly queue = new TxQueue();
  readonly contract: Contract;
  readonly wallet: Wallet;
  readonly provider: JsonRpcProvider;
  private readonly contractAddress: string;

  constructor(
    private readonly io: Server,
    rpcUrl: string,
    privateKey: string,
    contractAddress: string
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    const abi = loadAbi();
    this.contractAddress = contractAddress;
    this.contract = new Contract(contractAddress, abi, this.wallet);
  }

  private roomForGame(gameId: bigint | string): string {
    const id = typeof gameId === "bigint" ? gameId.toString() : gameId;
    return `game:${id}`;
  }

  private emitTxConfirmed(room: string, payload: TxConfirmedPayload): void {
    this.io.to(room).emit("tx-confirmed", payload);
  }

  private txPayload(
    receipt: ContractTransactionReceipt,
    type: TxConfirmedPayload["type"],
    gameId: string
  ): TxConfirmedPayload {
    const hash = receipt.hash;
    return {
      type,
      txHash: hash,
      from: receipt.from ?? this.wallet.address,
      to: receipt.to ?? this.contractAddress,
      gameId,
      timestamp: Date.now(),
    };
  }

  async createGame(): Promise<bigint> {
    return this.queue.enqueue(async () => {
      try {
        const tx = await this.contract.createGame();
        const receipt = (await tx.wait()) as ContractTransactionReceipt;
        const gameId = this.parseGameCreated(receipt);
        const gid = gameId.toString();
        this.emitTxConfirmed(
          this.roomForGame(gid),
          this.txPayload(receipt, "createGame", gid)
        );
        return gameId;
      } catch (e) {
        console.error("[ContractService] createGame", e);
        throw e;
      }
    });
  }

  async startGame(gameId: bigint): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const tx = await this.contract.startGame(gameId);
        const receipt = (await tx.wait()) as ContractTransactionReceipt;
        const gid = gameId.toString();
        this.emitTxConfirmed(
          this.roomForGame(gameId),
          this.txPayload(receipt, "startGame", gid)
        );
      } catch (e) {
        console.error("[ContractService] startGame", e);
        throw e;
      }
    });
  }

  async recordKill(gameId: bigint, killer: string, victim: string): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const tx = await this.contract.recordKill(gameId, killer, victim);
        const receipt = (await tx.wait()) as ContractTransactionReceipt;
        const gid = gameId.toString();
        this.emitTxConfirmed(
          this.roomForGame(gameId),
          this.txPayload(receipt, "recordKill", gid)
        );
      } catch (e) {
        console.error("[ContractService] recordKill", e);
      }
    });
  }

  async endGame(
    gameId: bigint,
    winner: string,
    winnerPoints: bigint
  ): Promise<{ ownerPayout: bigint; winnerPayout: bigint }> {
    return this.queue.enqueue(async () => {
      try {
        const tx = await this.contract.endGame(gameId, winner, winnerPoints);
        const receipt = (await tx.wait()) as ContractTransactionReceipt;
        const gid = gameId.toString();
        this.emitTxConfirmed(
          this.roomForGame(gameId),
          this.txPayload(receipt, "endGame", gid)
        );
        return this.parseGameEnded(receipt);
      } catch (e) {
        console.error("[ContractService] endGame", e);
        throw e;
      }
    });
  }

  async buyAmmo(gameId: bigint, player: string): Promise<void> {
    return this.queue.enqueue(async () => {
      try {
        const tx = await this.contract.buyAmmo(gameId, player);
        await tx.wait();
      } catch (e) {
        console.error("[ContractService] buyAmmo", e);
      }
    });
  }

  async getGameInfo(gameId: bigint): Promise<{
    status: number;
    playerCount: bigint;
    prizePool: bigint;
    protocolPoints: bigint;
  }> {
    const result = await this.contract.getGameInfo(gameId);
    return {
      status: Number(result[0]),
      playerCount: result[1],
      prizePool: result[2],
      protocolPoints: result[3],
    };
  }

  async getPlayer(
    gameId: bigint,
    player: string
  ): Promise<{
    points: bigint;
    hp: number;
    ammo: number;
    attackPower: number;
    joined: boolean;
  }> {
    const result = await this.contract.getPlayer(gameId, player);
    return {
      points: result[0],
      hp: Number(result[1]),
      ammo: Number(result[2]),
      attackPower: Number(result[3]),
      joined: result[4],
    };
  }

  async getPlayerList(gameId: bigint): Promise<string[]> {
    const list = await this.contract.getPlayerList(gameId);
    return [...list];
  }

  private parseGameCreated(receipt: ContractTransactionReceipt): bigint {
    const iface = this.contract.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === "GameCreated") {
          return parsed.args.gameId as bigint;
        }
      } catch {
        /* ignore */
      }
    }
    throw new Error("GameCreated event not found");
  }

  private parseGameEnded(receipt: ContractTransactionReceipt): {
    ownerPayout: bigint;
    winnerPayout: bigint;
  } {
    const iface = this.contract.interface;
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (parsed?.name === "GameEnded") {
          return {
            ownerPayout: parsed.args.ownerPayout as bigint,
            winnerPayout: parsed.args.winnerPayout as bigint,
          };
        }
      } catch {
        /* ignore */
      }
    }
    return { ownerPayout: 0n, winnerPayout: 0n };
  }
}
