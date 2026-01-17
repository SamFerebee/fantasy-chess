export type Team = "A" | "B";

/**
 * Placeholder render shape until real assets exist.
 * Later this can be ignored in favor of sprite/asset keys.
 */
export type UnitShape = "circle" | "rect";

export type AttackType = "melee" | "ranged";

/**
 * Logical unit identity (scout, knight, dragon, etc).
 * This is the key used to look up a unit's base attributes in the unit catalog.
 */
export type UnitName = "scout" | "fighter";

export type Unit = {
  /** Unique instance id on the board (e.g. "A1") */
  id: string;

  team: Team;

  /** Tile position */
  x: number;
  y: number;

  /**
   * Max action points available at the start of that unit's team's turn.
   * (Remaining AP is tracked elsewhere.)
   */
  actionPoints: number;

  /** Behavior bucket (for now: melee vs ranged). */
  attackType: AttackType;

  /** Unit identity / catalog key. */
  name: UnitName;

  /** Placeholder render shape until real assets exist. */
  shape: UnitShape;

  /**
   * Max distance (in tiles) this unit can target (Manhattan for now).
   */
  attackRange: number;

  /**
   * Combat stats
   */
  maxHP: number;
  hp: number;

  /**
   * Base damage dealt on a successful attack (before mitigation).
   */
  damage: number;

  /**
   * Flat damage reduction applied to incoming damage.
   * FinalDamage = max(0, incomingDamage - armor)
   */
  armor: number;
};
