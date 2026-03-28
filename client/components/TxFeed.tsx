"use client";

import { formatEther } from "ethers";
import type { TxConfirmedPayload, TxConfirmedType, TxFeedRow } from "@/lib/types";

const EXPLORER_TX = "https://testnet.monadexplorer.com/tx";

function shortHash(h: string) {
  if (h.length <= 16) return h;
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

function shortAddr(a: string) {
  if (a.length <= 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const TYPE_META: Record<TxConfirmedType, { icon: string; label: string }> = {
  createGame: { icon: "⊕", label: "Create game" },
  startGame: { icon: "▶", label: "Start battle" },
  recordKill: { icon: "☠", label: "Kill recorded" },
  recordShot: { icon: "🔫", label: "SHOT" },
  endGame: { icon: "◼", label: "End game" },
};

type Props = {
  entries: TxFeedRow[];
};

export function TxFeed({ entries }: Props) {
  return (
    <div className="mt-4 rounded border border-[#22ff66]/25 bg-black/50 p-3 shadow-[inset_0_0_20px_rgba(34,255,102,0.04)]">
      <h3 className="mb-2 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-[#22ff66]">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#22ff66] shadow-[0_0_8px_#22ff66]" />
        On-chain
      </h3>
      {entries.length === 0 ? (
        <p className="font-mono text-[10px] text-zinc-600">Awaiting transactions…</p>
      ) : (
        <ul className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
          {entries.map((row) => {
            if (row.kind === "shot") {
              const line = `SHOT ${shortAddr(row.shooter)} -${formatEther(row.costWei)} MON`;
              const pendingCls = row.confirmed
                ? "text-emerald-400/95"
                : "text-amber-400/70";
              return (
                <li
                  key={`shot-${row.shotId}-${row.timestamp}`}
                  className="rounded border border-zinc-800/90 bg-zinc-950/90 px-2 py-1.5 text-[11px] leading-snug"
                  style={{ animation: "tx-feed-in 0.35s ease-out forwards" }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 drop-shadow-[0_0_6px_rgba(34,255,102,0.35)] ${pendingCls}`}
                      aria-hidden
                    >
                      🔫
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className={`font-mono text-[10px] uppercase tracking-wide ${pendingCls}`}
                      >
                        {line}
                      </div>
                      {row.txHash ? (
                        <a
                          href={`${EXPLORER_TX}/${row.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-0.5 block truncate font-mono text-[10px] text-[#44ff88] underline decoration-[#22ff66]/40 underline-offset-2 transition hover:text-[#86ffb0] hover:decoration-[#22ff66]"
                        >
                          {shortHash(row.txHash)}
                        </a>
                      ) : (
                        <p className="mt-0.5 font-mono text-[10px] text-zinc-500">Pending…</p>
                      )}
                    </div>
                  </div>
                </li>
              );
            }

            const tx: TxConfirmedPayload = row.payload;
            const meta = TYPE_META[tx.type];
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
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-wide text-[#86ffb0]">
                      {meta.label}
                    </div>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate font-mono text-[10px] text-[#44ff88] underline decoration-[#22ff66]/40 underline-offset-2 transition hover:text-[#86ffb0] hover:decoration-[#22ff66]"
                    >
                      {shortHash(tx.txHash)}
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
