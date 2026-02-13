import type { BoardRulesConfig } from "../board/BoardRules";
import type { ClientCommandMessage, SnapshotSyncMessage } from "../net/NetMessages";
import type { GameAction, ApplyResult } from "./GameActions";
import type { GameEvent } from "./GameEvents";
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
  private cfg: BoardRulesConfig;

  // Client-side hook to drive render-state updates from sim results.
  private onApplied?: (res: ApplyResult) => void;

  private nextSeq = 1;
  private lastProcessedSeq = 0;

  constructor(args: { model: GameModel; cfg: BoardRulesConfig; startingSeq?: number; onApplied?: (res: ApplyResult) => void }) {
    this.model = args.model;
    this.cfg = args.cfg;
    this.onApplied = args.onApplied;
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
    const nowTurn = this.model.getTurnNumber();
    if (cmd.turnNumber !== nowTurn && cmd.action.type !== "endTurn") {
      return { ok: false, reason: "notYourTurn" };
    }

    const res = this.model.applyAction(cmd.action, this.cfg);
    if (res.ok) this.lastProcessedSeq = Math.max(this.lastProcessedSeq, cmd.seq);

    if (res.ok) this.onApplied?.(res);
    return res;
  }

  /**
   * Applies already-approved events client-side (no model mutation, no seq changes).
   *
   * Used for staged results like meleeChaseAttack where the sim has already applied
   * the full action, but the client wants to delay some events (e.g., hit feedback)
   * until after an animation completes.
   */
  applyDeferredEvents(events: GameEvent[]) {
    if (!events || events.length === 0) return;
    const res: ApplyResult = { ok: true, events };
    this.onApplied?.(res);
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
