export class ReachabilityCache {
  private selectedId: string | null = null;
  private budgetBySelected = new Map<string, number>();
  private reachableKeysBySelected = new Map<string, Set<string>>();

  clear() {
    this.selectedId = null;
    this.budgetBySelected.clear();
    this.reachableKeysBySelected.clear();
  }

  set(unitId: string, budget: number, keys: string[]) {
    this.selectedId = unitId;
    this.budgetBySelected.set(unitId, budget);
    this.reachableKeysBySelected.set(unitId, new Set(keys));
  }

  getBudgetForSelected(unitId: string): number {
    return this.budgetBySelected.get(unitId) ?? 0;
  }

  getKeysForSelected(unitId: string): Set<string> | null {
    return this.reachableKeysBySelected.get(unitId) ?? null;
  }
}
