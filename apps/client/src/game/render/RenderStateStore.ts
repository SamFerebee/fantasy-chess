import type { GameSnapshot } from "../sim/GameSnapshot";
import type { GameEvent } from "../sim/GameEvents";
import type { Team, UnitShape, UnitName, AttackType } from "../units/UnitTypes";
import { compareUnitId } from "../util/idSort";

/**
 * Minimal, renderer-facing unit state.
 *
 * This is intentionally a separate object graph from sim Units to avoid
 * accidental mutation coupling between UI/render code and authoritative sim.
 */
export type RenderUnitState = {
  id: string;
  team: Team;
  name: UnitName;
  shape: UnitShape;
  attackType: AttackType;

  x: number;
  y: number;

  hp: number;
  maxHP: number;
};

/**
 * Renderer-side state store updated only from sim events and/or snapshots.
 *
 * - Authoritative identity is `unitId`
 * - Ordering is stable via `unitOrder` (sorted by unitId)
 * - `unitsView` is a derived stable array reference for render loops
 */
export class RenderStateStore {
  private unitById = new Map<string, RenderUnitState>();
  private unitOrder: string[] = [];
  private unitsView: RenderUnitState[] = [];

  private revision = 0;

  getRevision(): number {
    return this.revision;
  }

  /** Stable array reference ordered by unitId. Treat as read-only. */
  getUnits(): RenderUnitState[] {
    return this.unitsView;
  }

  getUnit(id: string): RenderUnitState | null {
    return this.unitById.get(id) ?? null;
  }

  /**
   * Replace the entire render state from a snapshot.
   * Uses clones to avoid sharing object references with snapshot buffers.
   */
  applySnapshot(snapshot: GameSnapshot) {
    const nextById = new Map<string, RenderUnitState>();

    for (const u of snapshot.units) {
      nextById.set(u.id, {
        id: u.id,
        team: u.team,
        name: u.name,
        shape: u.shape,
        attackType: u.attackType,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHP: u.maxHP,
      });
    }

    this.unitById = nextById;
    this.unitOrder = [...nextById.keys()].sort(compareUnitId);
    this.rebuildUnitsViewInPlace();
    this.bump();
  }

  /**
   * Apply sim-originated events to update render state.
   *
   * Note: `unitRemoved` is intentionally NOT applied here.
   * Death visuals often need to play before removal. Call `finalizeRemoveUnit`.
   */
  applyEvents(events: GameEvent[]) {
    let changed = false;

    for (const ev of events) {
      switch (ev.type) {
        case "unitMoved": {
          const u = this.unitById.get(ev.unitId);
          if (!u) break;
          if (u.x === ev.x && u.y === ev.y) break;
          u.x = ev.x;
          u.y = ev.y;
          changed = true;
          break;
        }

        case "unitHpChanged": {
          const u = this.unitById.get(ev.unitId);
          if (!u) break;
          if (u.hp === ev.hp && u.maxHP === ev.maxHP) break;
          u.hp = ev.hp;
          u.maxHP = ev.maxHP;
          changed = true;
          break;
        }

        // unitDamaged is feedback-only; hp updates come via unitHpChanged.
        // apChanged / turnEnded / etc are not render-unit state.
        default:
          break;
      }
    }

    if (changed) this.bump();
  }

  /**
   * Remove a unit from render state (typically after death animation).
   */
  finalizeRemoveUnit(unitId: string) {
    if (!this.unitById.has(unitId)) return;
    this.unitById.delete(unitId);

    const idx = this.unitOrder.indexOf(unitId);
    if (idx !== -1) this.unitOrder.splice(idx, 1);

    this.rebuildUnitsViewInPlace();
    this.bump();
  }

  private rebuildUnitsViewInPlace() {
    this.unitsView.length = 0;
    for (const id of this.unitOrder) {
      const u = this.unitById.get(id);
      if (u) this.unitsView.push(u);
    }
  }

  private bump() {
    this.revision += 1;
  }
}
