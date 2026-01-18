import type { AttackProfile, AttackType, Team, Unit, UnitName, UnitShape } from "./UnitTypes";

export type UnitDef = {
  name: UnitName;

  // Rendering placeholder
  shape: UnitShape;

  // Turn economy
  actionPoints: number;

  // Combat stats
  maxHP: number;
  damage: number;
  armor: number;

  /**
   * Primary, future-proof attack definition.
   */
  attack: AttackProfile;
};

/**
 * Single source of truth for base unit attributes.
 */
export const UNIT_CATALOG: Record<UnitName, UnitDef> = {
  fighter: {
    name: "fighter",
    shape: "circle",
    actionPoints: 3,
    maxHP: 10,
    damage: 4,
    armor: 1,
    attack: {
      kind: "melee_adjacent",
      target: "unit",
      range: 1,
      apCost: 1,
      consumesRemainingAp: true,
    },
  },

  // Scout: target any tile within range 6.
  // If straight-line path is blocked before the aim tile, the resolver may still land the shot
  // using deterministic Scout rules (knight bypass + micro-lane seam threading).
  scout: {
    name: "scout",
    shape: "rect",
    actionPoints: 5,
    maxHP: 8,
    damage: 3,
    armor: 0,
    attack: {
      kind: "projectile_blockable_single",
      target: "tile",
      range: 6,
      canTargetEmptyTiles: true,
      apCost: 1,
      consumesRemainingAp: true,
    },
  },
};

export function getUnitDef(name: UnitName): UnitDef {
  const def = UNIT_CATALOG[name];
  if (!def) throw new Error(`Unknown UnitName "${String(name)}"`);
  return def;
}

function deriveLegacyAttackType(attack: AttackProfile): AttackType {
  switch (attack.kind) {
    case "melee_adjacent":
    case "quake_aoe":
      return "melee";

    case "projectile_blockable_single":
    case "projectile_unblockable_single":
    case "line_hit_all":
    case "pattern_shot":
      return "ranged";
  }
}

function deriveLegacyAttackRange(attack: AttackProfile): number {
  switch (attack.kind) {
    case "melee_adjacent":
      return 1;

    case "projectile_blockable_single":
    case "projectile_unblockable_single":
    case "line_hit_all":
      return Math.max(0, attack.range);

    case "pattern_shot":
      return Math.max(0, attack.maxRange);

    case "quake_aoe":
      return 0;
  }
}

export function createUnitFromCatalog(args: { id: string; team: Team; x: number; y: number; name: UnitName }): Unit {
  const def = getUnitDef(args.name);

  return {
    id: args.id,
    team: args.team,
    x: args.x,
    y: args.y,

    name: def.name,
    shape: def.shape,

    actionPoints: def.actionPoints,

    attack: def.attack,

    // Legacy fields (derived)
    attackType: deriveLegacyAttackType(def.attack),
    attackRange: deriveLegacyAttackRange(def.attack),

    maxHP: def.maxHP,
    hp: def.maxHP,

    damage: def.damage,
    armor: def.armor,
  };
}
