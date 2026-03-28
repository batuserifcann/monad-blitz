"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { GameCanvas } from "@/components/GameCanvas";
import { GameHUD } from "@/components/GameHUD";
import { GameOver } from "@/components/GameOver";
import { Lobby } from "@/components/Lobby";
import { WalletConnect } from "@/components/WalletConnect";
import { registerPlayer } from "@/lib/contract";
import { disconnectSocket, getSocket } from "@/lib/socket";
import type {
  GameEndedPayload,
  GameStatePayload,
  PlayerInputMessage,
  PlayerKeys,
  Tank,
} from "@/lib/types";

type KillEntry = { killer: string; victim: string; points: number };

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

  const keysRef = useRef<PlayerKeys>(defaultKeys());
  const shootPulseRef = useRef(false);
  const aimAngleRef = useRef(0);
  const snapshotRef = useRef<GameStatePayload | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    if (myTank) aimAngleRef.current = myTank.rotation;
  }, [myTank]);

  useEffect(() => {
    if (!socket) return;

    const onKill = (payload: {
      killer: string;
      victim: string;
      pointsTransferred: number;
    }) => {
      setKillFeed((prev) => {
        const next = [
          {
            killer: payload.killer,
            victim: payload.victim,
            points: payload.pointsTransferred,
          },
          ...prev,
        ];
        return next.slice(0, 5);
      });
    };

    const onEnded = (p: GameEndedPayload) => {
      setEnded(p);
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
  }, [socket]);

  const updateAimFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = clientX - rect.left;
      const my = clientY - rect.top;
      const addr = address;
      const snap = snapshotRef.current;
      if (!addr || !snap) return;
      const tank = snap.tanks.find((t) => t.address.toLowerCase() === addr.toLowerCase());
      if (!tank) return;
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
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  useEffect(() => {
    if (!joined || !gameId || !socket) return;

    let frame = 0;
    const tick = () => {
      const snap = snapshotRef.current;
      if (snap?.gameStatus === "active" && socket.connected) {
        const shoot = shootPulseRef.current;
        shootPulseRef.current = false;
        const keys = { ...keysRef.current, shoot };
        const msg: PlayerInputMessage = {
          gameId,
          keys,
          aimAngle: aimAngleRef.current,
        };
        socket.emit("player-input", msg);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [joined, gameId, socket]);

  const handlePointerMove = (e: React.MouseEvent) => {
    updateAimFromEvent(e.clientX, e.clientY);
  };

  const handlePointerDown = (e: React.MouseEvent) => {
    shootPulseRef.current = true;
    updateAimFromEvent(e.clientX, e.clientY);
  };

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
      const tx = await registerPlayer(BigInt(gameId));
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
          <p className="mb-3 text-sm text-zinc-400">
            Pay entry (0.1 MON) and register on-chain, then join the live room.
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
          <Lobby snapshot={snapshot} />
          <div className="relative">
            <div
              ref={wrapRef}
              className="relative inline-block cursor-crosshair"
              onMouseMove={handlePointerMove}
              onMouseDown={handlePointerDown}
              role="presentation"
            >
              <GameCanvas snapshot={snapshot} myTankId={myTankId} />
              <GameHUD
                snapshot={snapshot}
                myTank={myTank}
                killFeed={killFeed}
                centerMessage={centerMessage}
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
