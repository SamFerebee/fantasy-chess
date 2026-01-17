import type { Unit } from "./UnitTypes";
import { createUnitFromCatalog } from "./UnitCatalog";

type UnitSpawn = {
  id: string;
  team: "A" | "B";
  x: number;
  y: number;
  name: "scout" | "fighter";
};

/**
 * Spawn plan: only location + identity.
 * All other attributes come from UNIT_CATALOG via createUnitFromCatalog().
 */
const INITIAL_SPAWNS: UnitSpawn[] = [
  // Team A
  { id: "A1", team: "A", x: 3, y: 5, name: "fighter" },
  { id: "A2", team: "A", x: 4, y: 6, name: "fighter" },
  { id: "A3", team: "A", x: 2, y: 7, name: "scout" },

  // Team B
  { id: "B1", team: "B", x: 7, y: 5, name: "fighter" },
  { id: "B2", team: "B", x: 6, y: 6, name: "fighter" },
  { id: "B3", team: "B", x: 8, y: 3, name: "scout" },
];

export function createInitialUnits(): Unit[] {
  return INITIAL_SPAWNS.map((s) =>
    createUnitFromCatalog({
      id: s.id,
      team: s.team,
      x: s.x,
      y: s.y,
      name: s.name,
    })
  );
}
