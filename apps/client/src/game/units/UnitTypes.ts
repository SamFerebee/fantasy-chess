export type Team = "A" | "B";

/**
 * Placeholder render shape until real assets exist.
 * Later this can be ignored in favor of sprite/asset keys.
 */
export type UnitShape = "circle" | "rect";

/**
 * Legacy coarse categorization.
 * Keep for now because a lot of existing code branches on melee vs ranged.
 * Long-term: prefer `unit.attack.kind` to drive behavior.
 */
export type AttackType = "melee" | "ranged";

/**
 * Logical unit identity (scout, knight, dragon, etc).
 * This is the key used to look up a unit's base attributes in the unit catalog.
 */
export type UnitName = "scout" | "fighter";

/**
 * Future-proof attack definition.
 * - `kind` drives behavior and preview/overlays.
 * - Additional kinds can be added without changing `Unit` shape.
 */
type AttackBase = {
  /** AP cost to perform the attack (turn system decides how to apply this). */
  apCost: number;

  /**
   * If true, after paying apCost, the attack consumes all remaining AP (current behavior).
   * Keep as data so later units can opt out.
   */
  consumesRemainingAp: boolean;
};

export type AttackProfile =
  | (AttackBase & {
      kind: "melee_adjacent";
      target: "unit";
      range: 1;
    })
  | (AttackBase & {
      kind: "projectile_blockable_single";
      target: "tile";
      /** Primary max range gate (currently Manhattan distance). */
      range: number;
      /** Allow firing at empty tiles (current behavior). */
      canTargetEmptyTiles: true;

      /**
       * Optional fallback patterns that are ONLY considered when the straight-line
       * projectile path is blocked before the aim tile.
       *
       * Intended behavior:
       * - aim anywhere within range
       * - resolve as normal LOS projectile
       * - if blocked early, and aim delta matches a pattern endpoint, resolve via that pattern instead
       */
      patternFallbackIds?: string[];
    })
  | (AttackBase & {
      kind: "projectile_unblockable_single";
      target: "tile";
      range: number;
      canTargetEmptyTiles: true;
    })
  | (AttackBase & {
      kind: "line_hit_all";
      target: "tile";
      range: number;
      canTargetEmptyTiles: true;
    })
  | (AttackBase & {
      kind: "quake_aoe";
      target: "self";
      /** AOE radius around the attacker (Manhattan). */
      radius: number;
    })
  | (AttackBase & {
      /**
       * Deterministic pattern library shot (e.g., TAO scout patterns).
       * The resolver/preview uses `patternId` to fetch ordered offsets and resolve hits.
       */
      kind: "pattern_shot";
      target: "tile";
      patternId: string;
      maxRange: number;
      canTargetEmptyTiles: true;
      /** Whether units on intervening tiles block the pattern path. */
      blockedByUnits: boolean;
      /** Optional piercing count (0/undefined = first hit only). */
      pierceCount?: number;
    });

export type Unit = {
  /** Unique instance id on the board (e.g. "A1") */
  id: string;
  team: Team;
  x: number;
  y: number;

  /**
   * Max action points available at the start of that unit's team's turn.
   * - moving 1 tile costs 1 AP
   * - attacking costs 1 AP and consumes all remaining AP (current default)
   */
  actionPoints: number;

  /**
   * Legacy coarse behavior flag.
   * Derived from `attack.kind` in UnitCatalog; keep until all call sites migrate.
   */
  attackType: AttackType;

  /**
   * Logical unit identity (scout, fighter, etc).
   */
  name: UnitName;

  /**
   * Placeholder render shape until real assets exist.
   */
  shape: UnitShape;

  /**
   * Future-proof attack behavior definition.
   * This should be treated as the primary source of truth for how a unit attacks.
   */
  attack: AttackProfile;

  /**
   * Legacy max range gate used by existing code (overlays, resolver).
   * Derived from `attack` in UnitCatalog; keep until all call sites migrate.
   */
  attackRange: number;

  // Combat stats
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
