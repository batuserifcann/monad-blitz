import type { GameStatePayload } from "../types";

export const gameViewBridge: {
  snapshot: GameStatePayload | null;
  myTankId: string | null;
} = {
  snapshot: null,
  myTankId: null,
};
