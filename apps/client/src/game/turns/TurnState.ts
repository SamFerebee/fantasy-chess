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

  isTurnLockedToUnit(): boolean {
    return this.activatedUnitId !== null;
  }

  getActivatedUnitId(): string | null {
    return this.activatedUnitId;
  }

  canControlUnit(unit: Unit): boolean {
    if (unit.team !== this.activeTeam) return false;
    if (!this.activatedUnitId) return true;
    return unit.id === this.activatedUnitId;
  }

  getRemainingAp(unit: Unit): number {
    if (!this.canControlUnit(unit)) return 0;

    const existing = this.remainingAp.get(unit.id);
    if (existing !== undefined) return existing;

    this.remainingAp.set(unit.id, unit.actionPoints);
    return unit.actionPoints;
  }

  canAct(unit: Unit): boolean {
    return this.canControlUnit(unit) && this.getRemainingAp(unit) > 0;
  }

  spendForMove(unit: Unit, tilesMoved: number): boolean {
    if (tilesMoved <= 0) return false;
    if (!this.canControlUnit(unit)) return false;

    const rem = this.getRemainingAp(unit);
    if (rem < tilesMoved) return false;

    // First action of the turn locks the turn to this unit.
    if (!this.activatedUnitId) this.activatedUnitId = unit.id;

    this.remainingAp.set(unit.id, rem - tilesMoved);
    return true;
  }

  /**
   * Attacking costs 1 AP and consumes ALL remaining AP.
   * Requires at least 1 AP remaining.
   */
  spendForAttack(unit: Unit): boolean {
    if (!this.canControlUnit(unit)) return false;

    const rem = this.getRemainingAp(unit);
    if (rem < 1) return false;

    // First action of the turn locks the turn to this unit.
    if (!this.activatedUnitId) this.activatedUnitId = unit.id;

    this.remainingAp.set(unit.id, 0);
    return true;
  }

  endTurn() {
    this.activeTeam = this.activeTeam === "A" ? "B" : "A";
    this.activatedUnitId = null;
    this.remainingAp.clear();
  }
}
