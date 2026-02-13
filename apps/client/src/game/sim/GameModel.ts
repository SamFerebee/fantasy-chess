import type { BoardConfig } from "../board/BoardConfig";
import type { TileCoord } from "../movement/path";
import { buildBlockedSet, computeReachableTiles, isInBoundsAndNotCutout } from "../movement/movementRules";
import { getPathForMove } from "../movement/pathing";
import type { Unit, Team } from "../units/UnitTypes";
import { CombatResolver } from "../combat/CombatResolver";
import { computeAttackTiles } from "../combat/attackRange";
import { computeProjectilePreviewPath } from "../combat/ProjectilePreview";
import { TurnState } from "../turns/TurnState";
import { isAdjacent4Way } from "../rules/adjacency";
import type { GameAction, ApplyResult } from "./GameActions";
import type { GameEvent } from "./GameEvents";
import type { GameSnapshot } from "./GameSnapshot";
import { UnitIndex } from "./UnitIndex";

export type RNG = { nextFloat: () => number };

export class GameModel {
  private units: UnitIndex;

  private turn: TurnState;
  private combat: CombatResolver;
  private rng: RNG;

  constructor(units: Unit[], rng: RNG = { nextFloat: () => Math.random() }) {
    this.turn = new TurnState();
    this.combat = new CombatResolver();
    this.rng = rng;

    this.units = new UnitIndex(units);
  }

  // ---- Read-only helpers ----

  getUnitIds(): ReadonlyArray<string> {
    return this.units.getUnitIds();
  }

  /** @deprecated Prefer ids + getUnitById(). */
  getUnits(): ReadonlyArray<Unit> {
    return this.units.getUnitsView();
  }

  getActiveTeam(): Team {
    return this.turn.getActiveTeam();
  }

  getTurnNumber(): number {
    return this.turn.getTurnNumber();
  }

  getUnitById(id: string): Unit | null {
    return this.units.getUnitById(id);
  }

  getUnitAtTile(x: number, y: number): Unit | null {
    return this.units.getUnitAtTile(x, y);
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

  // ---- Snapshotting ----

  getSnapshot(): GameSnapshot {
    return {
      version: 1,
      units: this.units.getUnitIds().map((id) => cloneUnit(this.units.mustGetUnit(id))),
      turn: this.turn.snapshot(),
    };
  }

  restoreFromSnapshot(snap: GameSnapshot) {
    if (snap.version !== 1) {
      throw new Error(`Unsupported GameSnapshot version: ${String((snap as any).version)}`);
    }

    const nextUnits = snap.units.map(cloneUnit);
    this.units.loadUnits(nextUnits);

    this.turn.restore(snap.turn);
  }

  // ---- Derived data helpers ----

  previewMovePath(unitId: string, dest: TileCoord, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    return this.computeMovePath(unitId, dest, maxSteps, cfg);
  }

  getReachableTiles(unitId: string, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    const u = this.getUnitById(unitId);
    if (!u) return [];
    if (maxSteps <= 0) return [];

    const blocked = buildBlockedSet(this.units.getUnitsView(), unitId);
    return computeReachableTiles({ x: u.x, y: u.y }, maxSteps, cfg, blocked);
  }

  getAttackableTiles(unitId: string, cfg: BoardConfig): TileCoord[] {
    const u = this.getUnitById(unitId);
    if (!u) return [];
    return computeAttackTiles(u, cfg);
  }

  /**
   * Derived data: projectile preview path for overlays.
   * Delegated to combat module to keep GameModel smaller and ensure preview == resolver behavior.
   */
  getProjectilePreviewPath(attackerId: string, aimTile: TileCoord): TileCoord[] {
    const u = this.getUnitById(attackerId);
    if (!u) return [];
    return computeProjectilePreviewPath({ attacker: u, aimTile, units: this.units.getUnitsView() });
  }

  // ---- Deterministic action entrypoint ----

  applyAction(action: GameAction, cfg?: BoardConfig): ApplyResult {
    switch (action.type) {
      case "endTurn":
        return this.applyEndTurn();

      case "move":
        if (!cfg) return { ok: false, reason: "illegalMove" };
        return this.applyMove(action.unitId, action.to, cfg);

      case "attackTile":
        return this.applyAttackTile(action.attackerId, action.target);

      case "meleeChaseAttack":
        if (!cfg) return { ok: false, reason: "illegalMove" };
        return this.applyMeleeChaseAttack(action.attackerId, action.targetId, cfg);

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

    const occ = this.units.getUnitIdAtTile(dest.x, dest.y);
    if (occ && occ !== unitId) return [];

    const blocked = buildBlockedSet(this.units.getUnitsView(), unitId);
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

    this.units.setUnitTile(u.id, to.x, to.y);

    this.turn.spendForMove(u, cost);

    const events: GameEvent[] = [
      { type: "unitMoved", unitId: u.id, x: u.x, y: u.y },
      { type: "apChanged", unitId: u.id, remainingAp: this.turn.getRemainingAp(u) },
    ];

    if (this.turn.getRemainingAp(u) <= 0) {
      this.turn.endTurn();
      events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
    }

    return { ok: true, events, movePath: path, moveCost: cost };
  }

  private applyMeleeChaseAttack(attackerId: string, targetId: string, cfg: BoardConfig): ApplyResult {
    const attacker = this.getUnitById(attackerId);
    const target = this.getUnitById(targetId);
    if (!attacker) return { ok: false, reason: "invalidUnit" };
    if (!target) return { ok: false, reason: "illegalTarget" };

    if (!this.turn.canControlUnit(attacker)) return { ok: false, reason: "notYourTurn" };
    if (attacker.team === target.team) return { ok: false, reason: "illegalTarget" };
    if (attacker.attack.kind !== "melee_adjacent") return { ok: false, reason: "illegalMove" };

    // If already adjacent, just attack now.
    if (isAdjacent4Way(attacker, target)) {
      return this.applyAttackTile(attacker.id, { x: target.x, y: target.y });
    }

    const remainingAp = this.turn.getRemainingAp(attacker);
    if (remainingAp <= 0) return { ok: false, reason: "noAp" };

    const attackCost = Math.max(0, attacker.attack.apCost);
    const moveBudget = remainingAp - attackCost;
    if (moveBudget <= 0) return { ok: false, reason: "noAp" };

    // Deterministic candidate order.
    const candidates: TileCoord[] = [
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 },
    ];

    let best: { dest: TileCoord; path: TileCoord[]; cost: number } | null = null;

    for (const dest of candidates) {
      const path = this.computeMovePath(attacker.id, dest, moveBudget, cfg);
      if (!path || path.length < 2) continue;

      const cost = path.length - 1;
      if (cost <= 0 || cost > moveBudget) continue;

      if (!best || cost < best.cost) best = { dest, path, cost };
    }

    if (!best) return { ok: false, reason: "illegalMove" };

    // Apply the move now; stage attack events for after animation.
    this.units.setUnitTile(attacker.id, best.dest.x, best.dest.y);

    this.turn.spendForMove(attacker, best.cost);

    const moveEvents: GameEvent[] = [
      { type: "unitMoved", unitId: attacker.id, x: attacker.x, y: attacker.y },
      { type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) },
    ];

    if (!isAdjacent4Way(attacker, target)) return { ok: false, reason: "illegalMove" };

    const atkRes = this.applyAttackTile(attacker.id, { x: target.x, y: target.y });
    if (!atkRes.ok) return atkRes;

    return {
      ok: true,
      events: moveEvents,
      movePath: best.path,
      moveCost: best.cost,
      postMoveEvents: atkRes.events,
    };
  }

  private applyAttackTile(attackerId: string, target: TileCoord): ApplyResult {
    const attacker = this.getUnitById(attackerId);
    if (!attacker) return { ok: false, reason: "invalidUnit" };
    if (!this.turn.canControlUnit(attacker)) return { ok: false, reason: "notYourTurn" };
    if (!this.turn.canAttack(attacker)) return { ok: false, reason: "noAp" };

    // Some tile-targeted attacks may forbid aiming at empty tiles.
    const canTargetEmpty = (attacker.attack as any).canTargetEmptyTiles === true;
    if (!canTargetEmpty) {
      const aimed = this.getUnitAtTile(target.x, target.y);
      if (!aimed) return { ok: false, reason: "illegalTarget" };
    }

    const result = this.combat.tryAttackAtTile(attacker, target, this.units.getUnitsView());
    if (!result.ok) return { ok: false, reason: result.reason };

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

    const hitUnit = this.getUnitById(result.hit.id);
    if (!hitUnit) {
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

    const beforeHp = hitUnit.hp;
    if (result.targetHPAfter != null) hitUnit.hp = result.targetHPAfter;

    const events: GameEvent[] = [];

    if (result.damageDealt > 0) {
      events.push({ type: "unitDamaged", attackerId: attacker.id, targetId: hitUnit.id, amount: result.damageDealt });
    }

    if (beforeHp !== hitUnit.hp) {
      events.push({ type: "unitHpChanged", unitId: hitUnit.id, hp: hitUnit.hp, maxHP: hitUnit.maxHP });
    }

    if (result.killed) {
      this.units.removeUnit(hitUnit.id);
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
