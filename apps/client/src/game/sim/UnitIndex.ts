import type { Unit } from "../units/UnitTypes";

import { compareUnitId } from "../util/idSort";

/**
 * Authoritative, deterministic unit storage + fast lookup indexes.
 *
 * Responsibilities:
 * - canonical unit storage (by id)
 * - deterministic stable ordering (by compareUnitId)
 * - stable units view array (mutated in-place)
 * - fast tile occupancy index ("x,y" -> unitId)
 */
export class UnitIndex {
  private unitById = new Map<string, Unit>();
  private unitOrder: string[] = [];
  private unitsView: Unit[] = []; // stable reference

  private unitIdByTileKey = new Map<string, string>();

  constructor(units: Unit[]) {
    this.loadUnits(units);
  }

  // ---- Read-only helpers ----

  getUnitIds(): ReadonlyArray<string> {
    return this.unitOrder;
  }

  /**
   * Stable reference; mutated in-place when unit set changes.
   * Prefer ids + getUnitById() for future-proofing.
   */
  getUnitsView(): ReadonlyArray<Unit> {
    return this.unitsView;
  }

  getUnitById(id: string): Unit | null {
    return this.unitById.get(id) ?? null;
  }

  mustGetUnit(id: string): Unit {
    const u = this.unitById.get(id);
    if (!u) throw new Error(`Unit not found: ${id}`);
    return u;
  }

  getUnitAtTile(x: number, y: number): Unit | null {
    const id = this.getUnitIdAtTile(x, y);
    if (!id) return null;
    return this.unitById.get(id) ?? null;
  }

  getUnitIdAtTile(x: number, y: number): string | null {
    return this.unitIdByTileKey.get(tileKey(x, y)) ?? null;
  }

  // ---- Mutations (authoritative) ----

  loadUnits(units: Unit[]) {
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

  /**
   * Updates a unit's position and the occupancy index.
   * Does NOT perform rules validation.
   */
  setUnitTile(unitId: string, x: number, y: number) {
    const u = this.unitById.get(unitId);
    if (!u) return;

    this.unitIdByTileKey.delete(tileKey(u.x, u.y));
    u.x = x;
    u.y = y;
    this.unitIdByTileKey.set(tileKey(u.x, u.y), u.id);
  }

  removeUnit(unitId: string) {
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
