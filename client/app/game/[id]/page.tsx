"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { GameCanvas } from "@/components/GameCanvas";
import { GameHUD } from "@/components/GameHUD";
import { GameOver } from "@/components/GameOver";
import { Lobby } from "@/components/Lobby";
import { TxFeed } from "@/components/TxFeed";
import { WalletConnect } from "@/components/WalletConnect";
import { registerPlayer } from "@/lib/contract";
import { disconnectSocket, getSocket } from "@/lib/socket";
import { gameViewBridge } from "@/lib/phaser/bridge";
import {
  playShoot,
  playHit,
  playKill,
  playGameStart,
  playVictory,
} from "@/lib/audio";
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  type GameEndedPayload,
  type GameStatePayload,
  type PlayerInputMessage,
  type PlayerKeys,
  type Tank,
  type TxConfirmedPayload,
} from "@/lib/types";

type KillEntry = { killer: string; victim: string; monWei: string };

/** Match server tick (~30Hz); avoid flooding socket.io with 60+ emits/sec from rAF. */
const INPUT_EMIT_HZ = 30;

const defaultKeys = (): PlayerKeys => ({
  up: false,
  down: false,
  left: false,
  right: false,
  shoot: false,
});

export default function GameRoomPage() {
  const params = useParams();
  const gameId = String(params.id ?? "");

  const [address, setAddress] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [snapshot, setSnapshot] = useState<GameStatePayload | null>(null);
  const [ended, setEnded] = useState<GameEndedPayload | null>(null);
  const [killFeed, setKillFeed] = useState<KillEntry[]>([]);
  const [confirmedTxs, setConfirmedTxs] = useState<TxConfirmedPayload[]>([]);
  const [killFlash, setKillFlash] = useState(false);
  const [ammoCount, setAmmoCount] = useState(20);

  const keysRef = useRef<PlayerKeys>(defaultKeys());
  /** True while primary mouse button held (server uses rising edge on shoot). */
  const shootHeldRef = useRef(false);
  const aimAngleRef = useRef(0);
  const snapshotRef = useRef<GameStatePayload | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const inputEmitCountRef = useRef(0);
  const prevAmmoRef = useRef<number | null>(null);
  const prevStatusRef = useRef<string | null>(null);

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    setSocket(s);
    return () => {
      disconnectSocket();
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  /* ── sound triggers on snapshot changes ── */
  useEffect(() => {
    if (!snapshot || !address) return;

    /* shoot sound: own ammo decreased */
    const addr = address.toLowerCase();
    const me = snapshot.tanks.find((t) => t.address.toLowerCase() === addr);
    if (me) {
      if (prevAmmoRef.current !== null && me.ammo < prevAmmoRef.current) {
        playShoot();
      }
      prevAmmoRef.current = me.ammo;
    }

    /* game start sound: status transitions to active */
    if (snapshot.gameStatus === "active" && prevStatusRef.current !== "active") {
      playGameStart();
    }
    prevStatusRef.current = snapshot.gameStatus;
  }, [snapshot, address]);

  const myTankId = useMemo(() => {
    if (!address || !snapshot) return null;
    const a = address.toLowerCase();
    const t = snapshot.tanks.find((x) => x.address.toLowerCase() === a);
    return t?.id ?? null;
  }, [address, snapshot]);

  const myTank: Tank | null = useMemo(() => {
    if (!address || !snapshot) return null;
    const a = address.toLowerCase();
    return snapshot.tanks.find((x) => x.address.toLowerCase() === a) ?? null;
  }, [address, snapshot]);

  useEffect(() => {
    if (!socket) return;

    const onKill = (payload: {
      killer: string;
      victim: string;
      monTransferred: string;
    }) => {
      setKillFeed((prev) => {
        const next = [
          {
            killer: payload.killer,
            victim: payload.victim,
            monWei: payload.monTransferred,
          },
          ...prev,
        ];
        return next.slice(0, 5);
      });

      /* kill flash */
      setKillFlash(true);
      setTimeout(() => setKillFlash(false), 400);

      /* sound: kill vs hit */
      const addr = address?.toLowerCase();
      if (addr && payload.killer.toLowerCase() === addr) {
        playKill();
      } else if (addr && payload.victim.toLowerCase() === addr) {
        playHit();
      }
    };

    const onEnded = (p: GameEndedPayload) => {
      setEnded(p);
      const addr = address?.toLowerCase();
      const won = addr && p.winner.toLowerCase() === addr;
      gameViewBridge.gameOverState = won ? "win" : "lose";
      if (won) playVictory();
    };

    const onState = (s: GameStatePayload) => {
      setSnapshot(s);
    };

    const onErr = (e: { message?: string }) => {
      setJoinError(e?.message ?? "Socket error");
    };

    socket.on("game-state", onState);
    socket.on("player-killed", onKill);
    socket.on("game-ended", onEnded);
    socket.on("error", onErr);

    return () => {
      socket.off("game-state", onState);
      socket.off("player-killed", onKill);
      socket.off("game-ended", onEnded);
      socket.off("error", onErr);
    };
  }, [socket, address]);

  useEffect(() => {
    if (!socket || !joined) return;
    const onTxConfirmed = (payload: TxConfirmedPayload) => {
      if (payload.gameId !== gameId) return;
      setConfirmedTxs((prev) => [payload, ...prev].slice(0, 10));
    };
    socket.on("tx-confirmed", onTxConfirmed);
    return () => {
      socket.off("tx-confirmed", onTxConfirmed);
    };
  }, [socket, joined, gameId]);

  const updateAimFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      const rect = canvas?.getBoundingClientRect() ?? wrapRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect.height) return;
      const addr = address;
      const snap = snapshotRef.current;
      if (!addr || !snap) return;
      const tank = snap.tanks.find((t) => t.address.toLowerCase() === addr.toLowerCase());
      if (!tank) return;
      const scaleX = ARENA_WIDTH / rect.width;
      const scaleY = ARENA_HEIGHT / rect.height;
      const mx = (clientX - rect.left) * scaleX;
      const my = (clientY - rect.top) * scaleY;
      aimAngleRef.current = Math.atan2(my - tank.y, mx - tank.x);
    },
    [address]
  );

  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      if (k === "w") keys.up = true;
      if (k === "s") keys.down = true;
      if (k === "a") keys.left = true;
      if (k === "d") keys.right = true;
    };
    const ku = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      const keys = keysRef.current;
      if (k === "w") keys.up = false;
      if (k === "s") keys.down = false;
      if (k === "a") keys.left = false;
      if (k === "d") keys.right = false;
    };
    window.addEventListener("keydown", kd, true);
    window.addEventListener("keyup", ku, true);
    return () => {
      window.removeEventListener("keydown", kd, true);
      window.removeEventListener("keyup", ku, true);
    };
  }, []);

  useEffect(() => {
    if (!joined || !gameId || !socket) return;

    const intervalMs = 1000 / INPUT_EMIT_HZ;
    const id = window.setInterval(() => {
      const snap = snapshotRef.current;
      if (snap?.gameStatus !== "active" || !socket.connected) return;

      const keys: PlayerKeys = {
        ...keysRef.current,
        shoot: shootHeldRef.current,
      };
      const msg: PlayerInputMessage = {
        gameId,
        keys,
        aimAngle: aimAngleRef.current,
      };
      socket.emit("player-input", msg);

      inputEmitCountRef.current += 1;
      if (inputEmitCountRef.current % 90 === 0) {
        console.log("[input] player-input emit (~30Hz sample)", {
          keys,
          aimAngle: aimAngleRef.current,
        });
      }
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [joined, gameId, socket]);

  const handlePointerMove = (e: React.MouseEvent) => {
    updateAimFromEvent(e.clientX, e.clientY);
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).focus();
    shootHeldRef.current = true;
    updateAimFromEvent(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    shootHeldRef.current = false;
  };

  useEffect(() => {
    const onWinMouseUp = (e: MouseEvent) => {
      if (e.button === 0) shootHeldRef.current = false;
    };
    window.addEventListener("mouseup", onWinMouseUp);
    return () => window.removeEventListener("mouseup", onWinMouseUp);
  }, []);

  const handleJoin = async () => {
    if (!address) {
      setJoinError("Connect wallet first");
      return;
    }
    if (!socket) {
      setJoinError("Socket not ready");
      return;
    }
    setBusy(true);
    setJoinError(null);
    try {
      const tx = await registerPlayer(BigInt(gameId), ammoCount);
      await tx.wait();

      await new Promise<void>((resolve, reject) => {
        if (socket.connected) {
          resolve();
          return;
        }
        socket.once("connect", () => resolve());
        socket.once("connect_error", (err) => reject(err));
        socket.connect();
      });

      socket.emit("join-game", { gameId, playerAddress: address });
      setJoined(true);
    } catch (e) {
      setJoinError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const centerMessage = (() => {
    if (!snapshot) return null;
    if (ended) return null;
    if (snapshot.gameStatus === "waiting" && snapshot.tanks.length < 2) {
      return "Waiting for players…";
    }
    if (snapshot.gameStatus === "countdown" && snapshot.countdownSeconds !== undefined) {
      return `Starting in ${snapshot.countdownSeconds}s`;
    }
    if (snapshot.gameStatus === "active" && myTank && !myTank.alive) {
      return "YOU LOSE";
    }
    if (snapshot.gameStatus === "active" && myTank?.alive) {
      const alive = snapshot.tanks.filter((t) => t.alive);
      if (alive.length === 1 && alive[0]?.address.toLowerCase() === address?.toLowerCase()) {
        return "YOU WIN!";
      }
    }
    return null;
  })();

  return (
    <main className="mx-auto flex min-h-full max-w-5xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500">Game</p>
          <h1 className="font-mono text-xl text-white">#{gameId}</h1>
        </div>
        <WalletConnect onAddress={setAddress} />
      </div>

      {!joined && (
        <div className="rounded border border-zinc-800 bg-zinc-950/80 p-4">
          <label className="mb-2 block text-sm text-zinc-400">
            Ammo (10–50 bullets)
            <input
              type="range"
              min={10}
              max={50}
              value={ammoCount}
              onChange={(e) => setAmmoCount(Number(e.target.value))}
              className="mt-2 block w-full accent-[#22ff66]"
            />
          </label>
          <p className="mb-3 font-mono text-sm text-[#22ff66]">
            {ammoCount} bullets = {(ammoCount * 0.01).toFixed(2)} MON stake
          </p>
          <p className="mb-3 text-sm text-zinc-400">
            Pay your stake on-chain, then join the live room.
          </p>
          <button
            type="button"
            onClick={handleJoin}
            disabled={busy || !address || !socket}
            className="rounded border border-[#22ff66] bg-[#0d1a0f] px-4 py-2 text-sm font-bold text-[#22ff66] disabled:opacity-50"
          >
            {busy ? "Confirm in wallet…" : "Register & join"}
          </button>
          {joinError && <p className="mt-2 text-sm text-red-400">{joinError}</p>}
        </div>
      )}

      {joined && (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <Lobby snapshot={snapshot} txFeed={<TxFeed entries={confirmedTxs} />} />
          <div className="relative">
            <div
              ref={wrapRef}
              tabIndex={0}
              className="relative inline-block cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-[#22ff66]/50"
              onMouseMove={handlePointerMove}
              onMouseDown={handlePointerDown}
              onMouseUp={handlePointerUp}
              role="presentation"
            >
              <GameCanvas
                snapshot={snapshot}
                myTankId={myTankId}
                onCanvasReady={(c) => {
                  canvasRef.current = c;
                }}
              />
              <GameHUD
                myTank={myTank}
                killFeed={killFeed}
                centerMessage={centerMessage}
                killFlash={killFlash}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              WASD move · aim with mouse · click to shoot
            </p>
          </div>
        </div>
      )}

      {ended && ended.winner && (
        <GameOver payload={ended} myAddress={address} />
      )}
    </main>
  );
}
