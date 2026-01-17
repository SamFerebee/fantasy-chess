import type { Unit, Team } from "../units/UnitTypes";

export class TurnState {
  private activeTeam: Team = "A";

  // Once a unit spends AP or attacks, the turn is locked to that unit.
  private activatedUnitId: string | null = null;

  // Remaining AP for the currently-active team's units (lazy-initialized).
  private remainingAp = new Map<string, number>();

  getActiveTeam(): Team {
    return this.activeTeam;
  }

  endTurn() {
    this.activeTeam = this.activeTeam === "A" ? "B" : "A";
    this.activatedUnitId = null;
    this.remainingAp.clear();
  }

  canControlUnit(unit: Unit): boolean {
    if (unit.team !== this.activeTeam) return false;
    if (!this.activatedUnitId) return true;
    return unit.id === this.activatedUnitId;
  }

  getRemainingAp(unit: Unit): number {
    const existing = this.remainingAp.get(unit.id);
    if (existing != null) return existing;

    // Lazily initialize from unit base AP when first queried/spent this turn.
    this.remainingAp.set(unit.id, unit.actionPoints);
    return unit.actionPoints;
  }

  /**
   * General-purpose: "can take any action" (move, attack, etc.)
   * Attack-specific checks should use canAttack().
   */
  canAct(unit: Unit): boolean {
    if (!this.canControlUnit(unit)) return false;
    return this.getRemainingAp(unit) > 0;
  }

  canAttack(unit: Unit): boolean {
    if (!this.canControlUnit(unit)) return false;
    return this.getRemainingAp(unit) >= unit.attack.apCost;
  }

  spendForMove(unit: Unit, tilesMoved: number) {
    if (!this.canControlUnit(unit)) return;
    const rem = this.getRemainingAp(unit);
    const next = Math.max(0, rem - Math.max(0, tilesMoved));
    this.remainingAp.set(unit.id, next);
    if (!this.activatedUnitId) this.activatedUnitId = unit.id;
  }

  spendForAttack(unit: Unit) {
    if (!this.canControlUnit(unit)) return;

    const rem = this.getRemainingAp(unit);

    if (unit.attack.consumesRemainingAp) {
      this.remainingAp.set(unit.id, 0);
    } else {
      this.remainingAp.set(unit.id, Math.max(0, rem - Math.max(0, unit.attack.apCost)));
    }

    if (!this.activatedUnitId) this.activatedUnitId = unit.id;
  }
}
