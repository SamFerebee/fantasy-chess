import type Phaser from "phaser";
import type { TilePicker } from "../../input/TilePicker";
import type { TileOverlay } from "../../board/TileOverlay";
import type { UnitRenderer } from "../../units/UnitRenderer";
import type { MovementController } from "../../movement/MovementController";
import type { TurnController } from "../TurnController";
import type { ActionBar } from "../../ui/ActionBar";
import type { ActionMode } from "../../input/ActionMode";
import type { BoardConfig } from "../../board/BoardConfig";
import type { Unit } from "../../units/UnitTypes";

import { buildBlockedSet, isInBoundsAndNotCutout } from "../../movement/movementRules";
import { getPathForMove } from "../../movement/pathing";

type OverlayMode = {
  applyMode: (mode: ActionMode) => void;
  clearAll: () => void;
};

export function createSelectionClickHandler(args: {
  scene: Phaser.Scene;
  cam: Phaser.Cameras.Scene2D.Camera;
  cfg: BoardConfig;
  units: Unit[];
  picker: TilePicker;
  overlay: TileOverlay;
  unitRenderer: UnitRenderer;
  movement: MovementController;
  turns: TurnController;
  actionBar: ActionBar;
  overlayMode: OverlayMode;
}) {
  // Pending "move into range then attack" (melee only)
  let pendingMelee: { attackerId: string; target: Unit } | null = null;

  args.scene.events.on("move:complete", (payload: any) => {
    const unitId = payload?.unitId as string | undefined;
    if (!pendingMelee) return;
    if (!unitId || unitId !== pendingMelee.attackerId) return;

    const selected = args.unitRenderer.getSelectedUnit();
    const attacker = selected && selected.id === pendingMelee.attackerId ? selected : null;
    const target = pendingMelee.target;

    pendingMelee = null;

    if (!attacker) return;
    if (!args.turns.canActWithUnit(attacker)) return;
    if (target.team === attacker.team) return;

    // After moving, attempt the attack again.
    args.turns.tryAttack(attacker, target);
    // TurnController handles endTurn + clearing selection on attack.
  });

  const clearSelectionAndOverlays = () => {
    pendingMelee = null;

    args.unitRenderer.setSelectedUnitId(null);
    args.overlay.setSelected(null);
    args.movement.setSelectedUnit(null);
    args.movement.setHoverTile(null);
    args.overlayMode.clearAll();
  };

  const selectUnit = (unitId: string) => {
    pendingMelee = null;

    args.unitRenderer.setSelectedUnitId(unitId);
    args.overlay.setSelected(null);

    const u = args.unitRenderer.getSelectedUnit();
    if (u) {
      args.movement.setSelectedUnit(u, args.turns.getRemainingActionPoints(u));
    } else {
      args.movement.setSelectedUnit(null);
    }

    // selecting a unit defaults back to move
    args.actionBar.setMode("move");
    args.overlayMode.applyMode("move");
  };

  const isTileOccupiedByOther = (x: number, y: number, attackerId: string) => {
    const u = args.unitRenderer.getUnitAtTile(x, y);
    return !!u && u.id !== attackerId;
  };

  const tryMeleeChaseAndAttack = (attacker: Unit, target: Unit): boolean => {
    if (attacker.attackType !== "melee") return false;
    if (target.team === attacker.team) return false;

    const ap = args.turns.getRemainingActionPoints(attacker);
    // Need at least 1 AP to move (>=1 tile) AND 1 AP reserved for attack.
    if (ap < 2) return false;

    const moveBudget = ap - 1;

    // Candidate tiles: 4-way adjacent to target (melee range 1)
    const candidates = [
      { x: target.x + 1, y: target.y },
      { x: target.x - 1, y: target.y },
      { x: target.x, y: target.y + 1 },
      { x: target.x, y: target.y - 1 },
    ].filter((t) => isInBoundsAndNotCutout(t.x, t.y, args.cfg));

    const blocked = buildBlockedSet(args.units, attacker.id);

    let best: { x: number; y: number; cost: number } | null = null;

    for (const c of candidates) {
      // Must be empty (can be the attacker’s current tile only if already there, but then attack would have worked)
      if (isTileOccupiedByOther(c.x, c.y, attacker.id)) continue;

      const path = getPathForMove(attacker, c, moveBudget, args.cfg, blocked);
      if (!path || path.length < 2) continue;

      const cost = Math.max(0, path.length - 1);
      if (cost < 1) continue;
      if (cost > moveBudget) continue;

      if (!best || cost < best.cost) best = { x: c.x, y: c.y, cost };
    }

    if (!best) return false;

    // Start the move, reserving 1 AP for the attack.
    const res = args.movement.tryMoveTo({ x: best.x, y: best.y }, moveBudget);
    if (!res.ok) return false;

    // Spend move AP immediately
    args.turns.spendForMove(attacker, res.cost);

    // Queue the attack after the move animation completes
    pendingMelee = { attackerId: attacker.id, target };

    // Keep overlays in move mode while moving; movement blocks input anyway.
    return true;
  };

  const tryAttackOrMeleeChase = (attacker: Unit, target: Unit): boolean => {
    // First try immediate attack (works for ranged, and melee when adjacent)
    const didKill = args.turns.tryAttack(attacker, target);
    if (didKill) {
      clearSelectionAndOverlays();
      return true;
    }

    // If attack failed and attacker is melee, try chase+attack
    return tryMeleeChaseAndAttack(attacker, target);
  };

  const onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (args.movement.isAnimatingMove()) return;

    const world = args.cam.getWorldPoint(pointer.x, pointer.y);
    const selected = args.unitRenderer.getSelectedUnit();

    // 1) Unit shape click
    const hitUnit = args.unitRenderer.pickUnitAtWorldPoint(world.x, world.y);
    if (hitUnit) {
      // If a friendly unit is selected and can act, clicking an enemy attacks even in move mode.
      if (selected && args.turns.canActWithUnit(selected) && hitUnit.team !== selected.team) {
        const handled = tryAttackOrMeleeChase(selected, hitUnit);
        if (handled) return;
        return; // if not handled, do nothing
      }

      // Otherwise select only if controllable
      if (!args.turns.canControlUnit(hitUnit)) return;
      selectUnit(hitUnit.id);
      return;
    }

    // 2) Tile click
    const hitTile = args.picker.getTileAtPointer(pointer);

    if (selected && args.turns.canActWithUnit(selected) && hitTile) {
      const mode = args.actionBar.getMode();

      const unitOnTile = args.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
      if (unitOnTile) {
        const isEnemy = unitOnTile.team !== selected.team;

        if ((mode === "attack" || mode === "move") && isEnemy) {
          const handled = tryAttackOrMeleeChase(selected, unitOnTile);
          if (handled) return;
        }
        return;
      }

      // empty tile: move only in move mode
      if (mode === "move") {
        const budget = args.turns.getRemainingActionPoints(selected);
        const res = args.movement.tryMoveTo(hitTile, budget);
        if (res.ok) {
          args.turns.spendForMove(selected, res.cost);

          if (args.turns.getRemainingActionPoints(selected) <= 0) {
            clearSelectionAndOverlays();
          } else {
            const cur = args.unitRenderer.getSelectedUnit();
            args.movement.setSelectedUnit(cur, args.turns.getRemainingActionPoints(selected));
            args.overlayMode.applyMode("move");
          }
        }
        return;
      }

      return;
    }

    // 3) Select unit on tile (only if controllable)
    if (hitTile) {
      const unitOnTile = args.unitRenderer.getUnitAtTile(hitTile.x, hitTile.y);
      if (unitOnTile) {
        if (!args.turns.canControlUnit(unitOnTile)) return;
        selectUnit(unitOnTile.id);
        return;
      }
    }

    // 4) Otherwise select tile and clear unit selection / overlays
    pendingMelee = null;

    args.unitRenderer.setSelectedUnitId(null);
    args.overlay.setSelected(hitTile);
    args.movement.setSelectedUnit(null);
    args.movement.setHoverTile(null);
    args.overlayMode.clearAll();
  };

  return { onPointerDown };
}
