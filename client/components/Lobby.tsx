"use client";

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
      <ul className="mb-3 space-y-1 font-mono text-sm text-zinc-300">
        {tanks.length === 0 && <li className="text-zinc-500">No players yet.</li>}
        {tanks.map((t, i) => (
          <li key={t.id}>
            <span className="text-zinc-500">P{i + 1}</span> {shortAddr(t.address)}
          </li>
        ))}
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
