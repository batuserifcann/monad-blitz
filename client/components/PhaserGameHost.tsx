"use client";

import { useEffect, useRef } from "react";
import Phaser from "phaser";
import { gameViewBridge } from "@/lib/phaser/bridge";
import { TankScene } from "@/lib/phaser/TankScene";
import type { GameStatePayload } from "@/lib/types";

type Props = {
  snapshot: GameStatePayload | null;
  myTankId: string | null;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
};

export function PhaserGameHost({ snapshot, myTankId, onCanvasReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const onCanvasReadyRef = useRef(onCanvasReady);
  onCanvasReadyRef.current = onCanvasReady;

  useEffect(() => {
    gameViewBridge.snapshot = snapshot;
    gameViewBridge.myTankId = myTankId;
  }, [snapshot, myTankId]);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: el,
      backgroundColor: "#0a0a0a",
      scene: [TankScene],
      scale: {
        mode: Phaser.Scale.NONE,
      },
      input: {
        keyboard: false,
      },
    });
    gameRef.current = game;

    const canvas = game.canvas as HTMLCanvasElement;
    canvas.style.pointerEvents = "none";
    onCanvasReadyRef.current?.(canvas);

    return () => {
      game.destroy(true);
      gameRef.current = null;
      gameViewBridge.snapshot = null;
      gameViewBridge.myTankId = null;
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="overflow-hidden rounded border border-[#22ff66]/40 shadow-[0_0_24px_rgba(34,255,102,0.15)]"
    />
  );
}
