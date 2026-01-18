import type { GameAction } from "../sim/GameActions";
import type { GameSnapshot } from "../sim/GameSnapshot";

/**
 * Client -> server command envelope.
 *
 * - seq: monotonically increasing per-connection.
 * - turnNumber: the client's view of the current turn number when the input was generated.
 */
export type ClientCommandMessage = {
  kind: "command";
  seq: number;
  turnNumber: number;
  action: GameAction;
};

/**
 * Server -> client authoritative resync message shape.
 *
 * This is a POC/MVP shape only: it is not used yet, but is intentionally defined
 * now so the client simulation can evolve towards server-authority without churn.
 */
export type SnapshotSyncMessage = {
  kind: "snapshotSync";
  /** The last command seq the server has processed for this client (ack). */
  lastProcessedSeq: number;
  snapshot: GameSnapshot;
};

export type NetMessage = ClientCommandMessage | SnapshotSyncMessage;
