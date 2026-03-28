"use client";

import type { GameStatePayload, Tank } from "@/lib/types";

type KillEntry = { killer: string; victim: string; points: number };

type Props = {
  snapshot: GameStatePayload | null;
  myTank: Tank | null;
  killFeed: KillEntry[];
  centerMessage?: string | null;
};

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function GameHUD({ snapshot, myTank, killFeed, centerMessage }: Props) {
  const hp = myTank?.hp ?? 0;
  const hpMax = 10;
  const hpPct = Math.min(100, Math.max(0, (hp / hpMax) * 100));

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      <div className="absolute left-3 top-3 w-48">
        <div className="mb-1 text-xs uppercase text-zinc-500">HP</div>
        <div className="h-3 w-full overflow-hidden rounded border border-zinc-700 bg-black/60">
          <div
            className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-[width]"
            style={{ width: `${hpPct}%` }}
          />
        </div>
      </div>

      <div className="absolute right-3 top-3 text-right">
        <div className="text-xs uppercase text-zinc-500">Ammo</div>
        <div className="font-mono text-lg text-[#22ff66]">{myTank?.ammo ?? "—"}</div>
        <div className="mt-1 text-xs uppercase text-zinc-500">Points</div>
        <div className="font-mono text-lg text-zinc-100">{myTank?.points ?? "—"}</div>
      </div>

      {centerMessage && (
        <div className="absolute left-1/2 top-1/2 w-[90%] max-w-xl -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="rounded border border-[#22ff66]/40 bg-black/70 px-4 py-3 font-semibold text-[#22ff66] shadow-[0_0_30px_rgba(34,255,102,0.2)]">
            {centerMessage}
          </div>
        </div>
      )}

      <div className="absolute bottom-3 left-3 right-3 max-w-md">
        <div className="mb-1 text-xs uppercase text-zinc-500">Kill feed</div>
        <ul className="space-y-1 font-mono text-xs text-zinc-300">
          {killFeed.length === 0 && (
            <li className="text-zinc-600">No eliminations yet.</li>
          )}
          {killFeed.map((k, i) => (
            <li key={`${k.killer}-${k.victim}-${i}`}>
              <span className="text-red-300">{short(k.killer)}</span>
              <span className="text-zinc-500"> eliminated </span>
              <span className="text-zinc-200">{short(k.victim)}</span>
              <span className="text-zinc-600"> (+{k.points})</span>
            </li>
          ))}
        </ul>
      </div>

      {snapshot && (
        <div className="absolute bottom-3 right-3 text-right text-[10px] text-zinc-600">
          proto {snapshot.protocolPoints}
        </div>
      )}
    </div>
  );
}
