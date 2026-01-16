import type { Unit } from "./UnitTypes";

export function createInitialUnits(): Unit[] {
  return [
    { id: "A1", team: "A", x: 3, y: 5, moveRange: 3, shape: "circle" },
    { id: "A2", team: "A", x: 4, y: 6, moveRange: 3, shape: "circle" },
    { id: "B1", team: "B", x: 7, y: 5, moveRange: 3, shape: "circle" },
    { id: "B2", team: "B", x: 6, y: 6, moveRange: 3, shape: "circle" },

    // New: triangle unit with longer move range
    { id: "A3", team: "A", x: 2, y: 7, moveRange: 5, shape: "triangle" },
  ];
}
