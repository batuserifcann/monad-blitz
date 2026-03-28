"use client";

import { useMemo } from "react";
import { formatEther } from "ethers";
import type { TxConfirmedPayload, TxConfirmedType, TxFeedRow } from "@/lib/types";

const EXPLORER_TX = "https://testnet.monadexplorer.com/tx";

function shortAddr(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const CHAIN_LABEL: Record<TxConfirmedType, string> = {
  createGame: "CREATE GAME",
  startGame: "START BATTLE",
  recordKill: "KILL RECORDED",
  recordShot: "SHOT",
  endGame: "END GAME",
};

const CHAIN_ICON: Record<TxConfirmedType, string> = {
  createGame: "⊕",
  startGame: "▶",
  recordKill: "☠",
  recordShot: "🔫",
  endGame: "◼",
};

type Props = {
  entries: TxFeedRow[];
};

export function TxFeed({ entries }: Props) {
  const onChainCount = useMemo(
    () => entries.filter((e) => e.kind === "chain").length,
    [entries]
  );

  return (
    <div className="mt-4 rounded border border-[#22ff66]/25 bg-black/50 p-3 shadow-[inset_0_0_20px_rgba(34,255,102,0.04)]">
      <h3 className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22ff66]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#22ff66] shadow-[0_0_8px_#22ff66]" />
        Activity
      </h3>
      {entries.length === 0 ? (
        <p className="font-mono text-[10px] text-zinc-600">Awaiting activity…</p>
      ) : (
        <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
          {entries.map((row) => {
            if (row.kind === "shot") {
              const line = `${shortAddr(row.shooter)} · −${formatEther(row.costWei)} MON`;
              return (
                <li
                  key={`shot-${row.shotId}-${row.timestamp}`}
                  className="rounded border border-zinc-800/90 px-2 py-1.5 text-[11px] leading-snug"
                  style={{
                    animation:
                      "tx-feed-in 0.35s ease-out forwards, shot-flash-green 0.55s ease-out forwards",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#86ffb0]">
                        <span className="text-[#4ade80] drop-shadow-[0_0_8px_rgba(74,222,128,0.5)]" aria-hidden>
                          ⚡{" "}
                        </span>
                        SHOT
                      </div>
                      <div className="font-mono text-[10px] tracking-wide text-emerald-300/90">
                        {line}
                      </div>
                    </div>
                  </div>
                </li>
              );
            }

            const tx: TxConfirmedPayload = row.payload;
            const label = CHAIN_LABEL[tx.type];
            const icon = CHAIN_ICON[tx.type];
            const href = `${EXPLORER_TX}/${tx.txHash}`;
            return (
              <li
                key={`${tx.txHash}-${tx.timestamp}`}
                className="rounded border border-zinc-800/90 bg-zinc-950/90 px-2 py-1.5 text-[11px] leading-snug text-zinc-300"
                style={{ animation: "tx-feed-in 0.35s ease-out forwards" }}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 shrink-0 text-[#22ff66] drop-shadow-[0_0_6px_rgba(34,255,102,0.45)]"
                    aria-hidden
                  >
                    {icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wide text-[#86ffb0]">
                        {label}
                      </span>
                      <span className="rounded border border-[#22ff66]/45 bg-[#22ff66]/10 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-wider text-[#86ffb0]">
                        ON-CHAIN
                      </span>
                    </div>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block break-all font-mono text-[10px] text-[#44ff88] underline decoration-[#22ff66]/40 underline-offset-2 transition hover:text-[#86ffb0] hover:decoration-[#22ff66]"
                    >
                      {href}
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 border-t border-zinc-800/80 pt-2 font-mono text-[9px] uppercase tracking-wide text-zinc-500">
        {onChainCount} on-chain transaction{onChainCount === 1 ? "" : "s"} this game
      </p>
    </div>
  );
}
