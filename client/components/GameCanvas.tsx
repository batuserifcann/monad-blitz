"use client";

import dynamic from "next/dynamic";
import type { GameStatePayload } from "@/lib/types";

const PhaserGameHost = dynamic(
  () => import("./PhaserGameHost").then((m) => ({ default: m.PhaserGameHost })),
  { ssr: false, loading: () => <CanvasPlaceholder /> }
);

function CanvasPlaceholder() {
  return (
    <div className="flex h-[600px] w-[800px] items-center justify-center rounded border border-zinc-800 bg-black text-zinc-500">
      Loading battle…
    </div>
  );
}

type Props = {
  snapshot: GameStatePayload | null;
  myTankId: string | null;
};

export function GameCanvas(props: Props) {
  return <PhaserGameHost {...props} />;
}
