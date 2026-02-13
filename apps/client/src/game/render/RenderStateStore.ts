import type { GameSnapshot } from "../sim/GameSnapshot";
import type { GameEvent } from "../sim/GameEvents";
import type { Team, UnitShape, UnitName, AttackType } from "../units/UnitTypes";
import { compareUnitId } from "../util/idSort";

export type RenderUnitState = {
  id: string;
  team: Team;
  name: UnitName;
  shape: UnitShape;
  spriteKey: string;
  attackType: AttackType;

  x: number;
  y: number;

  hp: number;
  maxHP: number;
};

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

export class RenderStateStore {
  private unitById = new Map<string, RenderUnitState>();
  private unitOrder: string[] = [];
  private unitsView: RenderUnitState[] = [];

  // Optional perf/ergonomics: tile occupancy index for hover/click logic.
  private unitIdByTileKey = new Map<string, string>();

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

  getUnitIdAtTile(x: number, y: number): string | null {
    return this.unitIdByTileKey.get(tileKey(x, y)) ?? null;
  }

  applySnapshot(snapshot: GameSnapshot) {
    const nextById = new Map<string, RenderUnitState>();
    const nextByTile = new Map<string, string>();

    for (const u of snapshot.units) {
      const ru: RenderUnitState = {
        id: u.id,
        team: u.team,
        name: u.name,
        shape: u.shape,
        spriteKey: u.spriteKey,
        attackType: u.attackType,
        x: u.x,
        y: u.y,
        hp: u.hp,
        maxHP: u.maxHP,
      };
      nextById.set(u.id, ru);
      nextByTile.set(tileKey(ru.x, ru.y), ru.id);
    }

    this.unitById = nextById;
    this.unitIdByTileKey = nextByTile;
    this.unitOrder = [...nextById.keys()].sort(compareUnitId);
    this.rebuildUnitsViewInPlace();
    this.bump();
  }

  /**
   * Note: unitRemoved is intentionally NOT applied here. Call finalizeRemoveUnit()
   * after death visuals complete.
   */
  applyEvents(events: GameEvent[]) {
    let changed = false;

    for (const ev of events) {
      switch (ev.type) {
        case "unitMoved": {
          const u = this.unitById.get(ev.unitId);
          if (!u) break;

          if (u.x === ev.x && u.y === ev.y) break;

          // Update tile index
          this.unitIdByTileKey.delete(tileKey(u.x, u.y));
          u.x = ev.x;
          u.y = ev.y;
          this.unitIdByTileKey.set(tileKey(u.x, u.y), u.id);

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

        default:
          break;
      }
    }

    if (changed) this.bump();
  }

  finalizeRemoveUnit(unitId: string) {
    const u = this.unitById.get(unitId);
    if (!u) return;

    this.unitIdByTileKey.delete(tileKey(u.x, u.y));
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
