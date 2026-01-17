import type { Unit } from "./UnitTypes";

export function createInitialUnits(): Unit[] {
  return [
    // Melee (circles)
    { id: "A1", team: "A", x: 3, y: 5, actionPoints: 3, attackType: "melee", shape: "circle" },
    { id: "A2", team: "A", x: 4, y: 6, actionPoints: 3, attackType: "melee", shape: "circle" },
    { id: "B1", team: "B", x: 7, y: 5, actionPoints: 3, attackType: "melee", shape: "circle" },
    { id: "B2", team: "B", x: 6, y: 6, actionPoints: 3, attackType: "melee", shape: "circle" },

    // Ranged (rectangles)
    { id: "A3", team: "A", x: 2, y: 7, actionPoints: 5, attackType: "ranged", shape: "rect" },
    { id: "B3", team: "B", x: 8, y: 3, actionPoints: 5, attackType: "ranged", shape: "rect" },
  ];
}
