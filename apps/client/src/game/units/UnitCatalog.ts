import type { AttackType, Team, Unit, UnitName, UnitShape } from "./UnitTypes";

export type UnitDef = {
  name: UnitName;

  // Rendering placeholder
  shape: UnitShape;

  // Core behavior
  attackType: AttackType;

  // Turn economy
  actionPoints: number;

  // Targeting
  attackRange: number;

  // Combat stats
  maxHP: number;
  damage: number;
  armor: number;
};

/**
 * Single source of truth for base unit attributes.
 * Add new unit types here (knight, dragon, etc).
 */
export const UNIT_CATALOG: Record<UnitName, UnitDef> = {
  fighter: {
    name: "fighter",
    shape: "circle",
    attackType: "melee",
    actionPoints: 3,
    attackRange: 1,
    maxHP: 10,
    damage: 4,
    armor: 1,
  },

  scout: {
    name: "scout",
    shape: "rect",
    attackType: "ranged",
    actionPoints: 5,
    attackRange: 6,
    maxHP: 8,
    damage: 3,
    armor: 0,
  },
};

export function getUnitDef(name: UnitName): UnitDef {
  const def = UNIT_CATALOG[name];
  if (!def) throw new Error(`Unknown UnitName "${String(name)}"`);
  return def;
}

export function createUnitFromCatalog(args: {
  id: string;
  team: Team;
  x: number;
  y: number;
  name: UnitName;
}): Unit {
  const def = getUnitDef(args.name);

  return {
    id: args.id,
    team: args.team,
    x: args.x,
    y: args.y,

    name: def.name,
    shape: def.shape,
    attackType: def.attackType,

    actionPoints: def.actionPoints,
    attackRange: def.attackRange,

    maxHP: def.maxHP,
    hp: def.maxHP,

    damage: def.damage,
    armor: def.armor,
  };
}
