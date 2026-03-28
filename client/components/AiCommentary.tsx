"use client";

import { useEffect, useState } from "react";
import type { GameEndedPayload } from "@/lib/types";

type KillPayload = {
  killer: string;
  victim: string;
  monTransferred: string;
};

type Props = {
  killNonce: number;
  killPayload: KillPayload | null;
  gameEndPayload: GameEndedPayload | null;
};

export function AiCommentary({ killNonce, killPayload, gameEndPayload }: Props) {
  const [line, setLine] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (killNonce === 0 || !killPayload) return;
    let cancelled = false;
    setBusy(true);
    fetch("/api/commentary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "kill", payload: killPayload }),
    })
      .then(async (r) => {
        const j = (await r.json()) as { text?: string; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.text ?? "";
      })
      .then((t) => {
        if (!cancelled && t) setLine(t);
      })
      .catch(() => {
        if (!cancelled) setLine(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [killNonce, killPayload]);

  useEffect(() => {
    if (!gameEndPayload?.winner) return;
    let cancelled = false;
    setBusy(true);
    fetch("/api/commentary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "game_end", payload: gameEndPayload }),
    })
      .then(async (r) => {
        const j = (await r.json()) as { text?: string; error?: string };
        if (!r.ok) throw new Error(j.error ?? r.statusText);
        return j.text ?? "";
      })
      .then((t) => {
        if (!cancelled && t) setLine(t);
      })
      .catch(() => {
        if (!cancelled) setLine(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameEndPayload?.winner, gameEndPayload?.winnerPayout, gameEndPayload?.ownerPayout]);

  if (!line && !busy) return null;

  return (
    <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 border-t border-[#22ff66]/25 bg-black/85 px-3 py-2 backdrop-blur-sm">
      <p className="font-mono text-xs leading-relaxed text-[#22ff66] [text-shadow:0_0_12px_rgba(34,255,102,0.25)]">
        {busy && !line ? (
          <span className="text-zinc-500">Generating commentary…</span>
        ) : (
          <span>{line}</span>
        )}
      </p>
    </div>
  );
}
