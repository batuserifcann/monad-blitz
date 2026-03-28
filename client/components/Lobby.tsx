"use client";

import { formatEther } from "ethers";
import type { ReactNode } from "react";
import type { GameStatePayload } from "@/lib/types";

type Props = {
  snapshot: GameStatePayload | null;
  /** Shown below the player list (e.g. on-chain tx feed). */
  txFeed?: ReactNode;
};

function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

function fmtMon(wei: string): string {
  try {
    return `${formatEther(wei)} MON`;
  } catch {
    return wei;
  }
}

function hpBarClass(hp: number, alive: boolean): string {
  if (!alive) return "bg-zinc-600";
  if (hp > 50) return "bg-emerald-500";
  if (hp > 25) return "bg-amber-400";
  return "bg-red-500";
}

export function Lobby({ snapshot, txFeed }: Props) {
  if (!snapshot) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950/80 p-4 text-zinc-400">
        Connecting to lobby…
      </div>
    );
  }

  const { gameStatus, tanks, countdownSeconds } = snapshot;
  const waiting = gameStatus === "waiting" && tanks.length < 2;
  const countdown = gameStatus === "countdown";

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/80 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#22ff66]">
        Lobby
      </h2>
      <ul className="mb-3 space-y-3 font-mono text-sm">
        {tanks.length === 0 && <li className="text-zinc-500">No players yet.</li>}
        {tanks.map((t, i) => {
          const alive = t.alive;
          const hpPct = Math.max(0, Math.min(100, t.hp));
          const rowCls = alive ? "text-emerald-200/95" : "text-red-400/75";
          return (
            <li
              key={t.id}
              className={`rounded border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 ${alive ? "border-emerald-900/40" : "border-zinc-700/60 opacity-90"}`}
            >
              <div className={`flex items-center justify-between gap-2 ${rowCls}`}>
                <span className="text-zinc-500">P{i + 1}</span>
                <span className="truncate">{shortAddr(t.address)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded bg-zinc-800">
                  <div
                    className={`h-full transition-[width] duration-150 ${hpBarClass(t.hp, alive)}`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>
              <div
                className={`mt-1 flex flex-wrap justify-between gap-x-2 gap-y-0.5 text-xs ${alive ? "text-zinc-400" : "text-zinc-500"}`}
              >
                <span>HP {t.hp}</span>
                <span>Ammo {t.ammo}</span>
                <span>{fmtMon(t.monBalance)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      {waiting && (
        <p className="text-sm text-amber-200/90">Waiting for players… (need 2+)</p>
      )}
      {countdown && countdownSeconds !== undefined && (
        <p className="text-lg font-bold text-[#22ff66]">
          Starting in {countdownSeconds}s
        </p>
      )}
      {gameStatus === "active" && (
        <p className="text-sm text-emerald-300">Battle in progress.</p>
      )}
      {gameStatus === "ended" && (
        <p className="text-sm text-zinc-400">Match finished.</p>
      )}
      {txFeed}
    </div>
  );
}
