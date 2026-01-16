import type { Unit } from "./UnitTypes";

export function createInitialUnits(): Unit[] {
  return [
    { id: "A1", team: "A", x: 3, y: 5 },
    { id: "A2", team: "A", x: 4, y: 6 },
    { id: "B1", team: "B", x: 7, y: 5 },
    { id: "B2", team: "B", x: 6, y: 6 },
  ];
}
