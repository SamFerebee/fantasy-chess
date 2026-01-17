export type Team = "A" | "B";
export type UnitShape = "circle" | "rect";
export type AttackType = "melee" | "ranged";

export type Unit = {
  id: string;
  team: Team;
  x: number;
  y: number;

  /**
   * Max action points available at the start of that unit's team's turn.
   * - moving 1 tile costs 1 AP
   * - attacking costs 1 AP and consumes all remaining AP
   */
  actionPoints: number;

  /**
   * Determines attack behavior (for now: melee vs ranged).
   * Circle units are melee; rect units are ranged.
   */
  attackType: AttackType;

  shape: UnitShape;
};
