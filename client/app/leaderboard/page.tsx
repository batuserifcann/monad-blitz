"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatEther, getAddress } from "ethers";
import { readPlayerStats } from "@/lib/contract";

type Row = {
  address: string;
  wins: bigint;
  kills: bigint;
  earnings: bigint;
};

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      setLoading(true);
      try {
        const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(/\/$/, "");
        if (!serverUrl) {
          throw new Error("NEXT_PUBLIC_SERVER_URL is not set");
        }
        const res = await fetch(`${serverUrl}/api/leaderboard-addresses`);
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { addresses?: string[] };
        const raw = data.addresses ?? [];
        const stats: Row[] = [];
        for (const a of raw) {
          try {
            const addr = getAddress(a);
            const s = await readPlayerStats(addr);
            stats.push({
              address: addr,
              wins: s.wins,
              kills: s.kills,
              earnings: s.earnings,
            });
          } catch {
            /* skip bad address */
          }
        }
        const cmpDesc = (a: bigint, b: bigint): number => {
          if (a > b) return -1;
          if (a < b) return 1;
          return 0;
        };
        stats.sort(
          (x, y) =>
            cmpDesc(x.earnings, y.earnings) ||
            cmpDesc(x.wins, y.wins) ||
            cmpDesc(x.kills, y.kills)
        );
        if (!cancelled) setRows(stats);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2 border-b border-[#22ff66]/30 pb-6">
        <p className="font-mono text-xs uppercase tracking-[0.4em] text-[#22ff66]/80">
          Tank Blitz // Monad Testnet
        </p>
        <h1 className="font-mono text-3xl font-bold tracking-tight text-[#22ff66] [text-shadow:0_0_24px_rgba(34,255,102,0.35)]">
          &gt; LEADERBOARD
        </h1>
        <p className="max-w-xl font-mono text-sm text-zinc-500">
          On-chain lifetime stats for wallets seen by this server. Sorted by total earnings (MON).
        </p>
        <Link
          href="/"
          className="inline-block font-mono text-sm text-[#22ff66]/90 underline decoration-[#22ff66]/40 underline-offset-4 hover:text-[#22ff66]"
        >
          ← back
        </Link>
      </header>

      <section className="rounded border border-zinc-800 bg-black/80 p-1 font-mono shadow-[inset_0_0_0_1px_rgba(34,255,102,0.12),0_0_40px_rgba(0,0,0,0.6)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-2 border-b border-zinc-800/90 px-3 py-2 text-xs uppercase tracking-wider text-zinc-500">
          <span>address</span>
          <span className="text-right">wins</span>
          <span className="text-right">kills</span>
          <span className="text-right">earnings</span>
        </div>
        {loading && (
          <p className="px-3 py-8 text-sm text-zinc-500">Loading chain data…</p>
        )}
        {err && !loading && (
          <p className="px-3 py-8 text-sm text-red-400">{err}</p>
        )}
        {!loading && !err && rows.length === 0 && (
          <p className="px-3 py-8 text-sm text-zinc-500">
            No players yet. Play a match — addresses appear after join / kills / wins.
          </p>
        )}
        {!loading &&
          rows.map((r, i) => (
            <div
              key={r.address}
              className="grid grid-cols-[2fr_1fr_1fr_1.2fr] gap-2 border-b border-zinc-900/80 px-3 py-2.5 text-sm text-[#b8ffc8] last:border-0"
            >
              <span className="truncate text-[#22ff66]">
                <span className="text-zinc-600">#{i + 1}</span>{" "}
                {r.address.slice(0, 6)}…{r.address.slice(-4)}
              </span>
              <span className="text-right text-zinc-300">{r.wins.toString()}</span>
              <span className="text-right text-zinc-300">{r.kills.toString()}</span>
              <span className="text-right text-[#22ff66]">
                {Number(formatEther(r.earnings)).toFixed(4)} MON
              </span>
            </div>
          ))}
      </section>
    </main>
  );
}
