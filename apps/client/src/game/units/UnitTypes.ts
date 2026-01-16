export type Team = "A" | "B";
export type UnitShape = "circle" | "rect";

export type Unit = {
  id: string;
  team: Team;
  x: number;
  y: number;
  moveRange: number;
  shape: UnitShape;
};
