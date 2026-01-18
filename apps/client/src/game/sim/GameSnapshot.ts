import type { Unit } from "../units/UnitTypes";
import type { TurnStateSnapshot } from "../turns/TurnState";

/**
 * Serializable, versioned game snapshot.
 *
 * The intent is to make an eventual server-authoritative transition easier:
 * - server can send authoritative snapshots
 * - client can resync, rollback, or replay deterministically
 */
export type GameSnapshot = {
  version: 1;
  units: Unit[];
  turn: TurnStateSnapshot;
};
