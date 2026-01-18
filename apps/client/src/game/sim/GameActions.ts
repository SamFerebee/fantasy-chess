import type { TileCoord } from "../movement/path";
import type { GameEvent } from "./GameEvents";

export type GameAction =
  | { type: "endTurn" }
  | { type: "move"; unitId: string; to: TileCoord }
  | { type: "attackTile"; attackerId: string; target: TileCoord }
  | { type: "meleeChaseAttack"; attackerId: string; targetId: string };

export type ApplyResult =
  | {
      ok: false;
      reason:
        | "invalidUnit"
        | "notYourTurn"
        | "noAp"
        | "illegalMove"
        | "outOfRange"
        | "illegalTarget";
    }
  | {
      ok: true;
      /** Events to apply immediately (e.g., move events for meleeChaseAttack). */
      events: GameEvent[];

      /** Present for move-like actions to drive client-side animation. */
      movePath?: TileCoord[];
      /** Present for move actions. */
      moveCost?: number;

      /**
       * Optional staged events to apply AFTER the move animation completes.
       * Used by meleeChaseAttack so the client doesn't show the hit until the unit arrives.
       */
      postMoveEvents?: GameEvent[];
    };
