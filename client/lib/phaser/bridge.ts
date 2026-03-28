import type { GameStatePayload } from "../types";

export const gameViewBridge: {
  snapshot: GameStatePayload | null;
  myTankId: string | null;
  gameOverState: "win" | "lose" | null;
} = {
  snapshot: null,
  myTankId: null,
  gameOverState: null,
};
