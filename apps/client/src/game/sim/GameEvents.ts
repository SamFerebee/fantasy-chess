import type { Team } from "../units/UnitTypes";

export type GameEvent =
  | { type: "turnEnded"; activeTeam: Team }
  | { type: "unitMoved"; unitId: string; x: number; y: number }
  | { type: "unitRemoved"; unitId: string }
  | { type: "apChanged"; unitId: string; remainingAp: number }
  | { type: "unitHpChanged"; unitId: string; hp: number; maxHP: number }
  | { type: "unitDamaged"; attackerId: string; targetId: string; amount: number };
