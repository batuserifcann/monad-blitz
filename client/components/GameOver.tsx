"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatEther } from "ethers";
import type { GameEndedPayload } from "@/lib/types";

type Props = {
  payload: GameEndedPayload;
  myAddress: string | null;
};

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function GameOver({ payload, myAddress }: Props) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const won =
    myAddress &&
    payload.winner.toLowerCase() === myAddress.toLowerCase();

  let winnerWei: string;
  let ownerWei: string;
  try {
    winnerWei = formatEther(payload.winnerPayout);
    ownerWei = formatEther(payload.ownerPayout);
  } catch {
    winnerWei = payload.winnerPayout;
    ownerWei = payload.ownerPayout;
  }

  const handlePlayAgain = () => {
    router.push("/");
  };

  const handleNewGame = async () => {
    setCreating(true);
    try {
      const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(
        /\/$/,
        ""
      );
      if (!serverUrl) throw new Error("Server URL not configured");
      const res = await fetch(`${serverUrl}/api/create-game`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as { gameId: string };
      router.push(`/game/${data.gameId}`);
    } catch (e) {
      console.error("Failed to create game:", e);
      setCreating(false);
    }
  };

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4">
      <div className="max-w-md rounded border border-[#22ff66]/50 bg-zinc-950 p-6 text-center shadow-[0_0_40px_rgba(34,255,102,0.2)]">
        <h2 className="mb-2 text-2xl font-black tracking-tight text-[#22ff66]">
          {won ? "🏆 YOU WIN!" : "💀 GAME OVER"}
        </h2>
        <p className="mb-4 font-mono text-sm text-zinc-300">
          Winner: <span className="text-white">{short(payload.winner)}</span>
        </p>
        <div className="space-y-2 text-left text-sm text-zinc-400">
          <div className="flex justify-between gap-4">
            <span>Winner payout</span>
            <span className="font-mono text-[#22ff66]">{winnerWei} MON</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Owner / protocol</span>
            <span className="font-mono text-zinc-300">{ownerWei} MON</span>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 pointer-events-auto">
          <button
            type="button"
            onClick={handlePlayAgain}
            className="rounded border border-[#22ff66] bg-[#0d1a0f] py-2.5 text-sm font-bold uppercase tracking-wider text-[#22ff66] transition hover:bg-[#142818] hover:shadow-[0_0_16px_rgba(34,255,102,0.3)]"
          >
            PLAY AGAIN
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            disabled={creating}
            className="rounded border border-zinc-600 bg-zinc-900 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-[#22ff66]/60 hover:text-[#22ff66] disabled:opacity-50"
          >
            {creating ? "Creating…" : "NEW GAME"}
          </button>
        </div>
      </div>
    </div>
  );
}
