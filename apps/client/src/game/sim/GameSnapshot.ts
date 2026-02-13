import type { Unit } from "../units/UnitTypes";
import type { TurnStateSnapshot } from "../turns/TurnState";
import type { RngSnapshot } from "./DeterministicRng";

/**
 * Serializable, versioned game snapshot.
 *
 * The intent is to make an eventual server-authoritative transition easier:
 * - server can send authoritative snapshots
 * - client can resync, rollback, or replay deterministically
 */
export type GameSnapshot = {
  version: 2;
  units: Unit[];
  turn: TurnStateSnapshot;
  rng: RngSnapshot;
};
