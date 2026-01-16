export type Team = "A" | "B";
export type UnitShape = "circle" | "triangle";

export type Unit = {
  id: string;
  team: Team;
  x: number;
  y: number;
  moveRange: number;
  shape: UnitShape;
};
