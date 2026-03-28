import { NextRequest, NextResponse } from "next/server";

const SYSTEM =
  "You are a fast-paced esports commentator for Tank Blitz, an on-chain tank game. Give ONE short exciting sentence about the game event. Be dramatic, use gaming slang. Mention MON amounts.";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { type?: string; payload?: Record<string, unknown> };
  if (b.type !== "kill" && b.type !== "game_end") {
    return NextResponse.json({ error: "type must be kill or game_end" }, { status: 400 });
  }

  const userText =
    b.type === "kill"
      ? buildKillPrompt(b.payload ?? {})
      : buildGameEndPrompt(b.payload ?? {});

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    return NextResponse.json(
      { error: "Claude API error", detail: t.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text =
    data.content?.find((c) => c.type === "text")?.text?.trim() ??
    data.content?.[0]?.text?.trim() ??
    "";

  if (!text) {
    return NextResponse.json({ error: "Empty response" }, { status: 502 });
  }

  return NextResponse.json({ text: text.split("\n")[0]!.trim() });
}

function buildKillPrompt(p: Record<string, unknown>): string {
  const killer = String(p.killer ?? "");
  const victim = String(p.victim ?? "");
  const monWei = String(p.monTransferred ?? "0");
  return `Event: kill. Killer wallet: ${killer}. Victim wallet: ${victim}. MON transferred from victim to killer (wei): ${monWei}. One sentence.`;
}

function buildGameEndPrompt(p: Record<string, unknown>): string {
  const winner = String(p.winner ?? "");
  const winnerPayout = String(p.winnerPayout ?? "0");
  const ownerPayout = String(p.ownerPayout ?? "0");
  return `Event: match ended. Winner wallet: ${winner}. Winner payout (wei): ${winnerPayout}. Protocol fee (wei): ${ownerPayout}. One sentence.`;
}
