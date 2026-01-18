import type { BoardConfig } from "../../board/BoardConfig";
import type { TileOverlay } from "../../board/TileOverlay";
import type { TileHit } from "../../input/TilePicker";
import type { MovementController } from "../../movement/MovementController";
import type { Unit, Team } from "../../units/UnitTypes";
import type { UnitRenderer } from "../../units/UnitRenderer";
import type { ActionBar } from "../../ui/ActionBar";
import type { TurnController } from "../TurnController";
import type { GameModel } from "../../sim/GameModel";
import type { createOverlayModeManager } from "./OverlayModeManager";

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isAdjacent4Way(a: { x: number; y: number }, b: { x: number; y: number }) {
  return manhattan(a, b) === 1;
}

function isEnemy(a: Team, b: Team) {
  return a !== b;
}

export function createSelectionClickHandler(args: {
  cfg: BoardConfig;
  model: GameModel;
  overlay: TileOverlay;
  unitRenderer: UnitRenderer;
  movement: MovementController;
  turns: TurnController;
  actionBar: ActionBar;
  overlayMode: ReturnType<typeof createOverlayModeManager>;
}) {
  // After any animated move completes (including staged meleeChaseAttack), refresh selection/overlays.
  args.movement.on("move:complete", (p) => {
    const selectedId = args.unitRenderer.getSelectedUnitId();
    if (!selectedId) return;
    if (p.unitId !== selectedId) return;

    const uNow = args.model.getUnitById(selectedId);
    if (!uNow) {
      args.unitRenderer.setSelectedUnitId(null);
      args.overlay.setSelected(null);
      args.movement.setSelectedUnitId(null);
      args.movement.setHoverTile(null);
      args.overlayMode.applyMode(args.actionBar.getMode());
      return;
    }

    const stillControllable = args.turns.canControlUnit(uNow);
    const remaining = args.turns.getRemainingActionPoints(uNow);
    if (!stillControllable || remaining <= 0) {
      args.unitRenderer.setSelectedUnitId(null);
      args.overlay.setSelected(null);
      args.movement.setSelectedUnitId(null);
      args.movement.setHoverTile(null);
      args.overlayMode.applyMode(args.actionBar.getMode());
      return;
    }

    args.movement.setSelectedUnitId(uNow.id, remaining);
    args.overlay.setSelected({ x: uNow.x, y: uNow.y });
    args.overlayMode.applyMode(args.actionBar.getMode());
  });

  const clearSelection = () => {
    args.unitRenderer.setSelectedUnitId(null);
    args.overlay.setSelected(null);
    args.movement.setSelectedUnitId(null);
    args.movement.setHoverTile(null);
    args.overlayMode.applyMode(args.actionBar.getMode());
  };

  const selectUnit = (u: Unit) => {
    // Selecting any unit forces Move mode (existing behavior).
    args.actionBar.setMode("move");

    args.unitRenderer.setSelectedUnitId(u.id);
    args.overlay.setSelected({ x: u.x, y: u.y });

    const rem = args.turns.getRemainingActionPoints(u);
    args.movement.setSelectedUnitId(u.id, rem);
    args.movement.setHoverTile(null);

    args.overlayMode.applyMode(args.actionBar.getMode());
  };

  const tryMeleeChaseAttack = (attacker: Unit, target: Unit): boolean => {
    const res = args.turns.tryMeleeChaseAttack(attacker, target);
    if (!res.ok) return false;

    const path = res.movePath ?? [];
    const post = res.postMoveEvents ?? [];

    if (path.length >= 2 || post.length > 0) {
      args.movement.animateAppliedMove(attacker.id, path, post);
      return true;
    }

    // Resolved immediately as a normal attack (already adjacent).
    args.overlayMode.applyMode(args.actionBar.getMode());
    return true;
  };

  const handleMoveClick = (hit: TileHit, selected: Unit | null, clickedUnit: Unit | null) => {
    if (clickedUnit) {
      // In move mode:
      // - Clicking a controllable friendly unit selects it (and forces move mode).
      // - Clicking an enemy while you have a selected unit attacks it.
      //   * Melee will chase (shortest path within AP budget, reserving attack AP) then attack.
      //   * Ranged will attempt the attack immediately.
      if (args.turns.canControlUnit(clickedUnit)) {
        selectUnit(clickedUnit);
        return;
      }

      if (selected && isEnemy(selected.team, clickedUnit.team)) {
        if (selected.attackType === "melee" && !isAdjacent4Way(selected, clickedUnit)) {
          void tryMeleeChaseAttack(selected, clickedUnit);
          return;
        }

        const res = args.turns.tryAttackUnit(selected, clickedUnit);
        if (!res.ok) return;

        args.overlayMode.applyMode(args.actionBar.getMode());
        return;
      }

      return;
    }

    if (!hit) return;
    if (!selected) return;

    const moved = args.movement.tryMoveTo(hit);
    if (!moved) return;

    const uNow = args.model.getUnitById(selected.id);
    if (!uNow) {
      clearSelection();
      return;
    }

    const stillControllable = args.turns.canControlUnit(uNow);
    const remaining = args.turns.getRemainingActionPoints(uNow);
    if (!stillControllable || remaining <= 0) {
      clearSelection();
      return;
    }

    args.movement.setSelectedUnitId(uNow.id, remaining);
    args.overlay.setSelected({ x: uNow.x, y: uNow.y });
    args.overlayMode.applyMode(args.actionBar.getMode());
  };

  const handleAttackClick = (hit: TileHit, selected: Unit | null, clickedUnit: Unit | null) => {
    if (!selected) return;
    if (!hit) return;

    // Melee requires an enemy unit.
    if (selected.attackType === "melee") {
      if (!clickedUnit) return;
      if (!isEnemy(selected.team, clickedUnit.team)) return;

      if (!isAdjacent4Way(selected, clickedUnit)) {
        void tryMeleeChaseAttack(selected, clickedUnit);
        return;
      }

      const res = args.turns.tryAttackUnit(selected, clickedUnit);
      if (!res.ok) return;

      args.overlayMode.applyMode(args.actionBar.getMode());
      return;
    }

    const res = args.turns.tryAttackTile(selected, { x: hit.x, y: hit.y });
    if (!res.ok) return;

    args.overlayMode.applyMode(args.actionBar.getMode());
  };

  const onTileSelected = (hit: TileHit) => {
    if (args.movement.isAnimatingMove()) return;

    const selectedId = args.unitRenderer.getSelectedUnitId();
    const selected = selectedId ? args.model.getUnitById(selectedId) : null;
    const clickedUnit = hit ? args.model.getUnitAtTile(hit.x, hit.y) : null;
    const mode = args.actionBar.getMode();

    if (!hit) {
      clearSelection();
      return;
    }

    if (mode === "move") {
      handleMoveClick(hit, selected, clickedUnit);
      return;
    }

    if (mode === "attack") {
      // In attack mode, clicking any controllable unit selects it (and forces Move mode).
      if (clickedUnit && args.turns.canControlUnit(clickedUnit)) {
        selectUnit(clickedUnit);
        return;
      }

      handleAttackClick(hit, selected, clickedUnit);
      return;
    }
  };

  return { onTileSelected };
}
