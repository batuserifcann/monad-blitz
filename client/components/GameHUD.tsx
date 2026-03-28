"use client";

import { formatEther } from "ethers";
import type { Tank } from "@/lib/types";

type KillEntry = { killer: string; victim: string; monWei: string };

type Props = {
  myTank: Tank | null;
  killFeed: KillEntry[];
  centerMessage?: string | null;
  killFlash?: boolean;
};

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtMon(wei: string): string {
  try {
    return `${formatEther(wei)} MON`;
  } catch {
    return wei;
  }
}

export function GameHUD({ myTank, killFeed, centerMessage, killFlash }: Props) {
  const hp = myTank?.hp ?? 0;
  const hpMax = 100;
  const hpPct = Math.min(100, Math.max(0, (hp / hpMax) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Kill flash — red border pulse */}
      {killFlash && (
        <div
          className="absolute inset-0 rounded"
          style={{
            boxShadow: "inset 0 0 40px 8px rgba(255, 30, 30, 0.5)",
            animation: "killFlashAnim 0.4s ease-out forwards",
          }}
        />
      )}

      {/* HP bar */}
      <div className="absolute left-3 top-3 w-48">
        <div className="mb-1 text-xs uppercase text-zinc-500">HP</div>
        <div className="h-3 w-full overflow-hidden rounded border border-zinc-700 bg-black/60">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-[width]"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      {/* Ammo + MON */}
      <div className="absolute right-3 top-3 text-right">
        <div className="text-xs uppercase text-zinc-500">Ammo</div>
        <div className="font-mono text-lg text-[#22ff66]">{myTank?.ammo ?? "—"}</div>
        <div className="mt-1 text-xs uppercase text-zinc-500">Balance</div>
        <div className="font-mono text-lg text-zinc-100">
          {myTank ? fmtMon(myTank.monBalance) : "—"}
        </div>
      </div>

      {/* Center message */}
      {centerMessage && (
        <div className="absolute left-1/2 top-1/2 w-[90%] max-w-xl -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="rounded border border-[#22ff66]/40 bg-black/70 px-4 py-3 font-semibold text-[#22ff66] shadow-[0_0_30px_rgba(34,255,102,0.2)]">
            {centerMessage}
          </div>
        </div>
      )}

      {/* Kill feed */}
      <div className="absolute bottom-3 left-3 right-3 max-w-md">
        <div className="mb-1 text-xs uppercase text-zinc-500">Kill feed</div>
        <ul className="space-y-1 font-mono text-xs">
          {killFeed.length === 0 && (
            <li className="text-zinc-600">No eliminations yet.</li>
          )}
          {killFeed.map((k, i) => (
            <li
              key={`${k.killer}-${k.victim}-${i}`}
              className="text-zinc-300"
              style={{
                animation: i === 0 ? "killEntryPop 0.3s ease-out" : undefined,
              }}
            >
              <span className="text-zinc-500">💀 </span>
              <span className="font-bold text-red-400">{short(k.killer)}</span>
              <span className="font-bold uppercase text-zinc-400"> ELIMINATED </span>
              <span className="font-bold text-zinc-100">{short(k.victim)}</span>
              <span className="text-zinc-600"> (+{fmtMon(k.monWei)})</span>
            </li>
          ))}
        </ul>
      </div>

      {/* CSS animations (injected once) */}
      <style>{`
        @keyframes killFlashAnim {
          0%   { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes killEntryPop {
          0%   { transform: translateX(-8px); opacity: 0; }
          100% { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
