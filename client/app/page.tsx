"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { WalletConnect } from "@/components/WalletConnect";

export default function Home() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const createGame = async () => {
    setErr(null);
    setBusy(true);
    try {
      const serverUrl = (process.env.NEXT_PUBLIC_SERVER_URL || "").replace(
        /\/$/,
        ""
      );
      if (!serverUrl) {
        throw new Error(
          "NEXT_PUBLIC_SERVER_URL is not set (add your Render backend URL in Vercel env)."
        );
      }
      const res = await fetch(`${serverUrl}/api/create-game`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? res.statusText);
      }
      const data = (await res.json()) as { gameId: string };
      router.push(`/game/${data.gameId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const joinGame = () => {
    const id = joinId.trim();
    if (!id) {
      setErr("Enter a game ID");
      return;
    }
    setErr(null);
    router.push(`/game/${id}`);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#22ff66]/80">
          Monad Testnet
        </p>
        <h1 className="text-4xl font-black tracking-tight text-white">
          Tank Blitz
        </h1>
        <p className="text-zinc-400">
          Connect MetaMask on Monad Testnet, stake 0.1 MON, and battle in real time.
        </p>
      </header>

      <section className="rounded border border-zinc-800 bg-zinc-950/60 p-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
        <WalletConnect />
      </section>

      <section className="flex flex-col gap-4">
        <button
          type="button"
          onClick={createGame}
          disabled={busy}
          className="rounded border border-[#22ff66] bg-[#0d1a0f] py-3 text-center text-sm font-bold uppercase tracking-wider text-[#22ff66] transition hover:bg-[#142818] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create Game"}
        </button>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            placeholder="Game ID"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            className="flex-1 rounded border border-zinc-700 bg-black px-3 py-2 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-[#22ff66] focus:outline-none"
          />
          <button
            type="button"
            onClick={joinGame}
            className="rounded border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 hover:border-[#22ff66]/60 hover:text-[#22ff66]"
          >
            Join Game
          </button>
        </div>
        {err && <p className="text-sm text-red-400">{err}</p>}
      </section>
    </main>
  );
}
