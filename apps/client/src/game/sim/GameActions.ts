import type { TileCoord } from "../movement/path";
import type { GameEvent } from "./GameEvents";

export type GameAction =
  | { type: "endTurn" }
  | { type: "move"; unitId: string; to: TileCoord }
  | { type: "attackUnit"; attackerId: string; targetId: string };

export type ApplyResult =
  | { ok: false; reason: "invalidUnit" | "notYourTurn" | "noAp" | "illegalMove" | "outOfRange" }
  | {
      ok: true;
      events: GameEvent[];
      /** Present for move actions to drive client-side animation. */
      movePath?: TileCoord[];
      /** Present for move actions. */
      moveCost?: number;
    };
