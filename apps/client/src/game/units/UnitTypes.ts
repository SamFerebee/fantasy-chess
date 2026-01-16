export type Team = "A" | "B";

export type Unit = {
  id: string;
  team: Team;
  x: number; // tile x
  y: number; // tile y
};
