import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import { computeReachableKeySet } from "./movementRules";

export class ReachabilityCache {
  private cfg: BoardConfig;
  private units: Unit[];

  private selectedUnitId: string | null = null;
  private reachableKeys: Set<string> | null = null;

  constructor(cfg: BoardConfig, units: Unit[]) {
    this.cfg = cfg;
    this.units = units;
  }

  clear(): void {
    this.selectedUnitId = null;
    this.reachableKeys = null;
  }

  setSelected(unit: Unit | null): void {
    if (!unit) {
      this.clear();
      return;
    }

    if (this.selectedUnitId === unit.id && this.reachableKeys) return;

    this.selectedUnitId = unit.id;
    this.recompute(unit);
  }

  recompute(unit: Unit): void {
    this.selectedUnitId = unit.id;
    this.reachableKeys = computeReachableKeySet({
      cfg: this.cfg,
      selected: unit,
      units: this.units,
    });
  }

  ensure(unit: Unit): Set<string> {
    if (this.selectedUnitId !== unit.id || !this.reachableKeys) {
      this.recompute(unit);
    }
    return this.reachableKeys!;
  }

  get(): Set<string> | null {
    return this.reachableKeys;
  }
}
