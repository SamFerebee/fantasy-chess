import type { BoardConfig } from "../board/BoardConfig";
import type { TileCoord } from "../movement/path";
import { buildBlockedSet, isInBoundsAndNotCutout } from "../movement/movementRules";
import { getPathForMove } from "../movement/pathing";
import type { Unit, Team } from "../units/UnitTypes";
import { CombatResolver } from "../combat/CombatResolver";
import { TurnState } from "../turns/TurnState";
import { compareUnitId } from "../util/idSort";
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

  private applyAttackTile(attackerId: string, target: TileCoord): ApplyResult {
    const attacker = this.getUnitById(attackerId);
    if (!attacker) return { ok: false, reason: "invalidUnit" };
    if (!this.turn.canControlUnit(attacker)) return { ok: false, reason: "notYourTurn" };
    if (!this.turn.canAttack(attacker)) return { ok: false, reason: "noAp" };

    const result = this.combat.tryAttackAtTile(attacker, target, this.unitsView);
    if (!result.ok) return { ok: false, reason: "outOfRange" };

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
