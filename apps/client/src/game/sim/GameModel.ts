import type { BoardConfig } from "../board/BoardConfig";
import type { TileCoord } from "../movement/path";
import { buildBlockedSet, isInBoundsAndNotCutout } from "../movement/movementRules";
import { getPathForMove } from "../movement/pathing";
import type { Unit, Team } from "../units/UnitTypes";
import { CombatResolver } from "../combat/CombatResolver";
import { TurnState } from "../turns/TurnState";
import type { GameAction, ApplyResult } from "./GameActions";
import type { GameEvent } from "./GameEvents";
import type { GameSnapshot } from "./GameSnapshot";

export type RNG = { nextFloat: () => number };

export class GameModel {
  private units: Unit[];
  private turn: TurnState;
  private combat: CombatResolver;
  private rng: RNG;

  constructor(units: Unit[], rng: RNG = { nextFloat: () => Math.random() }) {
    this.units = units;
    this.turn = new TurnState();
    this.combat = new CombatResolver();
    this.rng = rng;
  }

  // ---- Read-only helpers ----

  getUnits(): Unit[] {
    return this.units;
  }

  getActiveTeam(): Team {
    return this.turn.getActiveTeam();
  }

  getTurnNumber(): number {
    return this.turn.getTurnNumber();
  }

  getUnitById(id: string): Unit | null {
    return this.units.find((u) => u.id === id) ?? null;
  }

  getUnitAtTile(x: number, y: number): Unit | null {
    return this.units.find((u) => u.x === x && u.y === y) ?? null;
  }

  getRemainingActionPoints(unit: Unit): number {
    return this.turn.getRemainingAp(unit);
  }

  canControlUnit(unit: Unit): boolean {
    return this.turn.canControlUnit(unit);
  }

  canActWithUnit(unit: Unit): boolean {
    return this.turn.canAct(unit);
  }

  canAttackWithUnit(unit: Unit): boolean {
    return this.turn.canAttack(unit);
  }

  // ---- Snapshotting (server-authoritative friendly) ----

  getSnapshot(): GameSnapshot {
    return {
      version: 1,
      units: this.units.map(cloneUnit),
      turn: this.turn.snapshot(),
    };
  }

  restoreFromSnapshot(snap: GameSnapshot) {
    if (snap.version !== 1) {
      throw new Error(`Unsupported GameSnapshot version: ${String((snap as any).version)}`);
    }

    this.units = snap.units.map(cloneUnit);
    this.turn.restore(snap.turn);
  }

  /**
   * Public, non-mutating move path preview.
   * Safe to use from UI/controllers (and later: client prediction) without changing model state.
   */
  previewMovePath(unitId: string, dest: TileCoord, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    return this.computeMovePath(unitId, dest, maxSteps, cfg);
  }

  // ---- Deterministic action entrypoint ----

  applyAction(action: GameAction, cfg?: BoardConfig): ApplyResult {
    switch (action.type) {
      case "endTurn":
        return this.applyEndTurn();

      case "move":
        if (!cfg) return { ok: false, reason: "illegalMove" };
        return this.applyMove(action.unitId, action.to, cfg);

      // FIX (line ~101/102): GameAction uses attackTile, not attackUnit.
      case "attackTile":
        return this.applyAttackTile(action.attackerId, action.target);

      default:
        return { ok: false, reason: "illegalMove" };
    }
  }

  // ---- Internals ----

  private applyEndTurn(): ApplyResult {
    this.turn.endTurn();
    const events: GameEvent[] = [{ type: "turnEnded", activeTeam: this.turn.getActiveTeam() }];
    return { ok: true, events };
  }

  private computeMovePath(unitId: string, dest: TileCoord, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    const u = this.getUnitById(unitId);
    if (!u) return [];
    if (maxSteps <= 0) return [];
    if (!isInBoundsAndNotCutout(dest.x, dest.y, cfg)) return [];
    if (dest.x === u.x && dest.y === u.y) return [];

    // Cannot end on another unit.
    for (const other of this.units) {
      if (other.id === unitId) continue;
      if (other.x === dest.x && other.y === dest.y) return [];
    }

    const blocked = buildBlockedSet(this.units, unitId);
    return getPathForMove(u, dest, maxSteps, cfg, blocked);
  }

  private applyMove(unitId: string, to: TileCoord, cfg: BoardConfig): ApplyResult {
    const u = this.getUnitById(unitId);
    if (!u) return { ok: false, reason: "invalidUnit" };
    if (!this.turn.canControlUnit(u)) return { ok: false, reason: "notYourTurn" };

    const remaining = this.turn.getRemainingAp(u);
    if (remaining <= 0) return { ok: false, reason: "noAp" };

    const path = this.computeMovePath(unitId, to, remaining, cfg);
    if (!path || path.length < 2) return { ok: false, reason: "illegalMove" };

    const cost = path.length - 1;

    // Apply position immediately (render can animate).
    u.x = to.x;
    u.y = to.y;

    this.turn.spendForMove(u, cost);

    const events: GameEvent[] = [
      { type: "unitMoved", unitId: u.id, x: u.x, y: u.y },
      { type: "apChanged", unitId: u.id, remainingAp: this.turn.getRemainingAp(u) },
    ];

    // Rule: if you hit 0 AP after a move, the turn ends.
    if (this.turn.getRemainingAp(u) <= 0) {
      this.turn.endTurn();
      events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
    }

    return { ok: true, events, movePath: path, moveCost: cost };
  }

  private applyAttackTile(attackerId: string, target: TileCoord): ApplyResult {
    const attacker = this.getUnitById(attackerId);
    if (!attacker) return { ok: false, reason: "invalidUnit" };
    if (!this.turn.canControlUnit(attacker)) return { ok: false, reason: "notYourTurn" };
    if (!this.turn.canAttack(attacker)) return { ok: false, reason: "noAp" };

    // Allows targeting empty tiles for scouts; CombatResolver decides hit unit (or null).
    const result = this.combat.tryAttackAtTile(attacker, target, this.units);
    if (!result.ok) return { ok: false, reason: "outOfRange" };

    // FIX (line ~179): result.hit can be null for empty-tile shots (or pure “miss”).
    if (!result.hit) {
      this.turn.spendForAttack(attacker);

      const events: GameEvent[] = [
        { type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) },
      ];

      if (attacker.attack.consumesRemainingAp || this.turn.getRemainingAp(attacker) <= 0) {
        this.turn.endTurn();
        events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
      }

      return { ok: true, events };
    }

    const hitId = result.hit.id;
    const hitUnit = this.getUnitById(hitId);

    if (!hitUnit) {
      // Defensive; should not happen.
      this.turn.spendForAttack(attacker);

      const events: GameEvent[] = [
        { type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) },
      ];

      if (attacker.attack.consumesRemainingAp || this.turn.getRemainingAp(attacker) <= 0) {
        this.turn.endTurn();
        events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
      }

      return { ok: true, events };
    }

    // Apply damage results.
    const beforeHp = hitUnit.hp;

    // FIX (line ~194): targetHPAfter can be null if hit==null; we’re in hit!=null branch,
    // but keep a defensive guard in case resolver returns inconsistent values.
    if (result.targetHPAfter != null) {
      hitUnit.hp = result.targetHPAfter;
    }

    const events: GameEvent[] = [];

    if (result.damageDealt > 0) {
      events.push({
        type: "unitDamaged",
        attackerId: attacker.id,
        targetId: hitUnit.id,
        amount: result.damageDealt,
      });
    }

    if (beforeHp !== hitUnit.hp) {
      events.push({ type: "unitHpChanged", unitId: hitUnit.id, hp: hitUnit.hp, maxHP: hitUnit.maxHP });
    }

    if (result.killed) {
      const idx = this.units.findIndex((u) => u.id === hitUnit.id);
      if (idx !== -1) this.units.splice(idx, 1);
      events.push({ type: "unitRemoved", unitId: hitUnit.id });
    }

    this.turn.spendForAttack(attacker);
    events.push({ type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) });

    if (attacker.attack.consumesRemainingAp || this.turn.getRemainingAp(attacker) <= 0) {
      this.turn.endTurn();
      events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
    }

    return { ok: true, events };
  }
}

function cloneUnit(u: Unit): Unit {
  return {
    ...u,
    attack: { ...(u.attack as any) } as any,
  };
}
