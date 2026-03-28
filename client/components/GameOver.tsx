"use client";

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

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-4">
      <div className="max-w-md rounded border border-[#22ff66]/50 bg-zinc-950 p-6 text-center shadow-[0_0_40px_rgba(34,255,102,0.2)]">
        <h2 className="mb-2 text-2xl font-black tracking-tight text-[#22ff66]">
          {won ? "YOU WIN!" : "GAME OVER"}
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
      </div>
    </div>
  );
}
