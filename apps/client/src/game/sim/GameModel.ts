import type { BoardConfig } from "../board/BoardConfig";
import type { TileCoord } from "../movement/path";
import { buildBlockedSet, computeReachableTiles, isInBoundsAndNotCutout } from "../movement/movementRules";
import { getPathForMove } from "../movement/pathing";
import type { Unit, Team } from "../units/UnitTypes";
import { CombatResolver } from "../combat/CombatResolver";
import { computeAttackTiles } from "../combat/attackRange";
import type { PosUnit } from "../combat/lineOfSight";
import { computeProjectilePath } from "../combat/lineOfSight";
import { resolvePatternShot } from "../combat/PatternShotResolver";
import { TurnState } from "../turns/TurnState";
import { compareUnitId } from "../util/idSort";
import { isAdjacent4Way } from "../rules/adjacency";
import type { GameAction, ApplyResult } from "./GameActions";
import type { GameEvent } from "./GameEvents";
import type { GameSnapshot } from "./GameSnapshot";

export type RNG = { nextFloat: () => number };

export class GameModel {
  private unitById = new Map<string, Unit>();
  private unitOrder: string[] = [];
  private unitsView: Unit[] = []; // stable reference

  // Fast tile occupancy index: "x,y" -> unitId
  private unitIdByTileKey = new Map<string, string>();

  private turn: TurnState;
  private combat: CombatResolver;
  private rng: RNG;

  constructor(units: Unit[], rng: RNG = { nextFloat: () => Math.random() }) {
    this.turn = new TurnState();
    this.combat = new CombatResolver();
    this.rng = rng;

    this.loadUnits(units);
  }

  // ---- Read-only helpers ----

  /**
   * Stable unit id ordering (authoritative ids, not array indices).
   * Treat as read-only.
   */
  getUnitIds(): ReadonlyArray<string> {
    return this.unitOrder;
  }

  /**
   * @deprecated Avoid using this from view/controller code. Prefer ids + getUnitById().
   * Stable array view ordered by unitId. Treat as read-only.
   */
  getUnits(): ReadonlyArray<Unit> {
    return this.unitsView;
  }

  getActiveTeam(): Team {
    return this.turn.getActiveTeam();
  }

  getTurnNumber(): number {
    return this.turn.getTurnNumber();
  }

  getUnitById(id: string): Unit | null {
    return this.unitById.get(id) ?? null;
  }

  getUnitAtTile(x: number, y: number): Unit | null {
    const id = this.unitIdByTileKey.get(tileKey(x, y));
    if (!id) return null;
    return this.unitById.get(id) ?? null;
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
      units: this.unitOrder.map((id) => cloneUnit(this.mustGetUnit(id))),
      turn: this.turn.snapshot(),
    };
  }

  restoreFromSnapshot(snap: GameSnapshot) {
    if (snap.version !== 1) {
      throw new Error(`Unsupported GameSnapshot version: ${String((snap as any).version)}`);
    }

    const nextUnits = snap.units.map(cloneUnit);
    this.loadUnits(nextUnits);

    this.turn.restore(snap.turn);
  }

  /**
   * Public, non-mutating move path preview.
   * Safe to use from UI/controllers without changing model state.
   */
  previewMovePath(unitId: string, dest: TileCoord, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    return this.computeMovePath(unitId, dest, maxSteps, cfg);
  }

  /**
   * Derived data: all reachable tiles within `maxSteps` for the given unit.
   * Safe for UI previews and server validation (pure function over current state).
   */
  getReachableTiles(unitId: string, maxSteps: number, cfg: BoardConfig): TileCoord[] {
    const u = this.getUnitById(unitId);
    if (!u) return [];
    if (maxSteps <= 0) return [];

    const blocked = buildBlockedSet(this.unitsView, unitId);
    return computeReachableTiles({ x: u.x, y: u.y }, maxSteps, cfg, blocked);
  }

  /**
   * Derived data: all tiles that this unit can target (range overlay).
   */
  getAttackableTiles(unitId: string, cfg: BoardConfig): TileCoord[] {
    const u = this.getUnitById(unitId);
    if (!u) return [];
    return computeAttackTiles(u, cfg);
  }

  /**
   * Derived data: projectile/LOS preview path for a ranged attacker.
   * Returns empty if attacker doesn't exist.
   *
   * Rule:
   * - Always show the normal straight-line projectile path first.
   * - If that path is blocked before the aim tile, and the attack has fallback patterns,
   *   and the aim matches a legal pattern endpoint, preview the pattern path instead.
   */
  getProjectilePreviewPath(attackerId: string, aimTile: TileCoord): TileCoord[] {
    const u = this.getUnitById(attackerId);
    if (!u) return [];

    const unitsPos: PosUnit[] = this.unitsView.map((x) => ({ id: x.id, x: x.x, y: x.y }));
    const attackerPos: PosUnit = { id: u.id, x: u.x, y: u.y };

    // Default: straight-line LOS path (truncated at first blocker).
    const losPath = computeProjectilePath(attackerPos, aimTile, unitsPos);
    if (losPath.length === 0) return losPath;

    const last = losPath[losPath.length - 1];
    const blockedBeforeAim = last.x !== aimTile.x || last.y !== aimTile.y;

    if (u.attack.kind === "projectile_blockable_single" && blockedBeforeAim) {
      const fallbackIds = u.attack.patternFallbackIds ?? [];
      if (fallbackIds.length > 0) {
        for (const patternId of fallbackIds) {
          const res = resolvePatternShot({
            attacker: u,
            aimTile,
            units: this.unitsView,
            patternId,
            blockedByUnits: true,
            pierceCount: undefined,
          });
          if (!res) continue;
          return res.path;
        }
      }
    }

    return losPath;
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

    const occ = this.unitIdByTileKey.get(tileKey(dest.x, dest.y));
    if (occ && occ !== unitId) return [];

    const blocked = buildBlockedSet(this.unitsView, unitId);
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

    this.unitIdByTileKey.delete(tileKey(u.x, u.y));
    u.x = to.x;
    u.y = to.y;
    this.unitIdByTileKey.set(tileKey(u.x, u.y), u.id);

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

    // If already adjacent, just attack now (no staging needed).
    if (isAdjacent4Way(attacker, target)) {
      return this.applyAttackTile(attacker.id, { x: target.x, y: target.y });
    }

    const remainingAp = this.turn.getRemainingAp(attacker);
    if (remainingAp <= 0) return { ok: false, reason: "noAp" };

    const attackCost = Math.max(0, attacker.attack.apCost);
    const moveBudget = remainingAp - attackCost;
    if (moveBudget <= 0) return { ok: false, reason: "noAp" };

    // Deterministic candidate order (stable across client/server).
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

    // Apply the move portion now, but only emit move events immediately.
    this.unitIdByTileKey.delete(tileKey(attacker.x, attacker.y));
    attacker.x = best.dest.x;
    attacker.y = best.dest.y;
    this.unitIdByTileKey.set(tileKey(attacker.x, attacker.y), attacker.id);

    this.turn.spendForMove(attacker, best.cost);

    const moveEvents: GameEvent[] = [
      { type: "unitMoved", unitId: attacker.id, x: attacker.x, y: attacker.y },
      { type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) },
    ];

    // After moving, we must now be adjacent.
    if (!isAdjacent4Way(attacker, target)) {
      return { ok: false, reason: "illegalMove" };
    }

    // Apply the attack portion now, but stage its events for after the move animation.
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

    const result = this.combat.tryAttackAtTile(attacker, target, this.unitsView);
    if (!result.ok) return { ok: false, reason: result.reason };

    if (!result.hit) {
      this.turn.spendForAttack(attacker);

      const events: GameEvent[] = [{ type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) }];

      if (attacker.attack.consumesRemainingAp || this.turn.getRemainingAp(attacker) <= 0) {
        this.turn.endTurn();
        events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
      }

      return { ok: true, events };
    }

    const hitUnit = this.getUnitById(result.hit.id);
    if (!hitUnit) {
      this.turn.spendForAttack(attacker);

      const events: GameEvent[] = [{ type: "apChanged", unitId: attacker.id, remainingAp: this.turn.getRemainingAp(attacker) }];

      if (attacker.attack.consumesRemainingAp || this.turn.getRemainingAp(attacker) <= 0) {
        this.turn.endTurn();
        events.push({ type: "turnEnded", activeTeam: this.turn.getActiveTeam() });
      }

      return { ok: true, events };
    }

    const beforeHp = hitUnit.hp;

    if (result.targetHPAfter != null) {
      hitUnit.hp = result.targetHPAfter;
    }

    const events: GameEvent[] = [];

    if (result.damageDealt > 0) {
      events.push({ type: "unitDamaged", attackerId: attacker.id, targetId: hitUnit.id, amount: result.damageDealt });
    }

    if (beforeHp !== hitUnit.hp) {
      events.push({ type: "unitHpChanged", unitId: hitUnit.id, hp: hitUnit.hp, maxHP: hitUnit.maxHP });
    }

    if (result.killed) {
      this.removeUnit(hitUnit.id);
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

  // ---- Authoritative unit storage helpers ----

  private loadUnits(units: Unit[]) {
    validateUnits(units);

    this.unitById.clear();
    this.unitIdByTileKey.clear();

    for (const u of units) {
      this.unitById.set(u.id, u);
      this.unitIdByTileKey.set(tileKey(u.x, u.y), u.id);
    }

    this.unitOrder = units.map((u) => u.id).sort(compareUnitId);
    this.rebuildUnitsViewInPlace();
  }

  private removeUnit(unitId: string) {
    const u = this.unitById.get(unitId);
    if (!u) return;

    this.unitById.delete(unitId);
    this.unitIdByTileKey.delete(tileKey(u.x, u.y));

    const idx = this.unitOrder.indexOf(unitId);
    if (idx !== -1) this.unitOrder.splice(idx, 1);

    this.rebuildUnitsViewInPlace();
  }

  private rebuildUnitsViewInPlace() {
    this.unitsView.length = 0;
    for (const id of this.unitOrder) {
      const u = this.unitById.get(id);
      if (u) this.unitsView.push(u);
    }
  }

  private mustGetUnit(id: string): Unit {
    const u = this.unitById.get(id);
    if (!u) throw new Error(`Unit not found: ${id}`);
    return u;
  }
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function validateUnits(units: Unit[]) {
  const seenIds = new Set<string>();
  const seenTiles = new Set<string>();

  for (const u of units) {
    if (!u || typeof u.id !== "string" || u.id.trim() === "") {
      throw new Error("Unit missing valid id");
    }
    if (seenIds.has(u.id)) throw new Error(`Duplicate unit id detected: ${u.id}`);
    seenIds.add(u.id);

    const k = tileKey(u.x, u.y);
    if (seenTiles.has(k)) throw new Error(`Duplicate tile occupancy detected at ${k}`);
    seenTiles.add(k);
  }
}

function cloneUnit(u: Unit): Unit {
  return {
    ...u,
    attack: { ...(u.attack as any) } as any,
  };
}
