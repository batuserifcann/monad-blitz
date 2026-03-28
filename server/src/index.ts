import * as path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "node:http";
import { Server as SocketIOServer } from "socket.io";
import { ContractService } from "./blockchain/ContractService.js";
import { GameManager } from "./game/GameManager.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const PORT = Number(process.env.PORT ?? 3001);
const rpcUrl =
  process.env.MONAD_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const privateKey = process.env.PRIVATE_KEY ?? "";
const contractAddress = process.env.CONTRACT_ADDRESS ?? "";

if (!privateKey || !contractAddress) {
  console.error("[server] Set PRIVATE_KEY and CONTRACT_ADDRESS in .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

const contractService = new ContractService(rpcUrl, privateKey, contractAddress);

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

const gameManager = new GameManager(io, contractService);

app.post("/api/create-game", async (_req, res) => {
  try {
    const { gameId } = await gameManager.createGameFromApi();
    res.json({ gameId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

app.get("/api/game/:gameId", async (req, res) => {
  try {
    const info = await gameManager.getGameInfoForApi(req.params.gameId);
    res.json(info);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
});

io.on("connection", (socket) => {
  socket.on("join-game", async (msg) => {
    try {
      await gameManager.handleJoin(socket, msg);
    } catch (e) {
      console.error(e);
      socket.emit("error", { message: "join-game failed" });
    }
  });

  socket.on("player-input", (msg) => {
    gameManager.handleInput(socket, msg);
  });

  socket.on("disconnect", () => {
    gameManager.handleDisconnect(socket);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Tank Blitz server listening on http://localhost:${PORT}`);
});
