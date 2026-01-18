import type { BoardConfig } from "../board/BoardConfig";
import type { ClientCommandMessage, SnapshotSyncMessage } from "../net/NetMessages";
import type { GameAction, ApplyResult } from "./GameActions";
import type { GameSnapshot } from "./GameSnapshot";
import type { GameModel } from "./GameModel";

/**
 * Local action queue + sequencing scaffold.
 *
 * For now, this is single-player and applies commands immediately.
 * Later, the same envelope types can be sent to a server, and
 * the server can reply with SnapshotSync to resync the client.
 */
export class ActionQueue {
  private model: GameModel;
  private cfg: BoardConfig;

  private nextSeq = 1;
  private lastProcessedSeq = 0;

  constructor(args: { model: GameModel; cfg: BoardConfig; startingSeq?: number }) {
    this.model = args.model;
    this.cfg = args.cfg;
    if (args.startingSeq != null) this.nextSeq = Math.max(1, Math.floor(args.startingSeq));
  }

  getLastProcessedSeq(): number {
    return this.lastProcessedSeq;
  }

  /**
   * Creates a client command envelope and applies it immediately.
   *
   * No gameplay change: this simply wraps the existing model.applyAction.
   */
  submitLocal(action: GameAction): ApplyResult {
    const cmd: ClientCommandMessage = {
      kind: "command",
      seq: this.nextSeq++,
      turnNumber: this.model.getTurnNumber(),
      action,
    };

    return this.applyCommand(cmd);
  }

  /**
   * Applies a command envelope.
   *
   * In a future server-authoritative world, this would be called only for
   * server-approved commands or replayed predicted commands.
   */
  applyCommand(cmd: ClientCommandMessage): ApplyResult {
    // Soft validation scaffold (should never fail for local commands).
    // Keeping it strict makes future networking bugs easier to detect.
    const nowTurn = this.model.getTurnNumber();
    if (cmd.turnNumber !== nowTurn && cmd.action.type !== "endTurn") {
      return { ok: false, reason: "notYourTurn" };
    }

    const res = this.model.applyAction(cmd.action, this.cfg);
    if (res.ok) this.lastProcessedSeq = Math.max(this.lastProcessedSeq, cmd.seq);
    return res;
  }

  /**
   * Produces a SnapshotSync message that a server might send.
   * Useful for defining the contract early, even before networking exists.
   */
  createSnapshotSyncMessage(): SnapshotSyncMessage {
    const snapshot: GameSnapshot = this.model.getSnapshot();
    return {
      kind: "snapshotSync",
      lastProcessedSeq: this.lastProcessedSeq,
      snapshot,
    };
  }
}
