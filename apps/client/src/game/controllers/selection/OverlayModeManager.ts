import type { BoardConfig } from "../../board/BoardConfig";
import type { UnitRenderer } from "../../units/UnitRenderer";
import type { MovementController } from "../../movement/MovementController";
import type { TurnController } from "../TurnController";
import type { ActionBar } from "../../ui/ActionBar";
import type { ActionMode } from "../../input/ActionMode";
import type { AttackRangeOverlay } from "../../combat/AttackRangeOverlay";
import type { ProjectilePathOverlay } from "../../combat/ProjectilePathOverlay";
import type { Unit } from "../../units/UnitTypes";

import { computeAttackTiles } from "../../combat/attackRange";
import { computeProjectilePath } from "../../combat/lineOfSight";
import { computeScoutProjectilePath } from "../../combat/scout/ScoutShot";
import { isInBoundsAndNotCutout } from "../../movement/movementRules";

type Tile = { x: number; y: number } | null;

export function createOverlayModeManager(args: {
  cfg: BoardConfig;
  getUnits: () => Unit[];
  unitRenderer: UnitRenderer;
  turns: TurnController;
  movement: MovementController;
  actionBar: ActionBar;
  attackOverlay: AttackRangeOverlay;
  projectilePathOverlay: ProjectilePathOverlay;
}) {
  const applyMode = (mode: ActionMode) => {
    const selected = args.unitRenderer.getSelectedUnit();

    args.projectilePathOverlay.clear();

    if (!selected || !args.turns.canControlUnit(selected)) {
      args.movement.setMoveRangeEnabled(false);
      args.movement.setHoverTile(null);
      args.attackOverlay.setSelectedUnit(null, []);
      return;
    }

    if (mode === "move") {
      args.attackOverlay.setSelectedUnit(null, []);
      args.movement.setMoveRangeEnabled(true, args.turns.getRemainingActionPoints(selected));
      args.movement.setHoverTile(null);
      return;
    }

    args.movement.setHoverTile(null);
    args.movement.setMoveRangeEnabled(false);

    const tiles = computeAttackTiles(selected, args.cfg);
    args.attackOverlay.setSelectedUnit(selected, tiles);
  };

  const clearAll = () => {
    args.movement.setMoveRangeEnabled(false);
    args.movement.setHoverTile(null);
    args.attackOverlay.setSelectedUnit(null, []);
    args.projectilePathOverlay.clear();
  };

  const handleHover = (hit: Tile) => {
    const selected = args.unitRenderer.getSelectedUnit();

    args.projectilePathOverlay.clear();

    if (!selected || !args.turns.canActWithUnit(selected)) {
      args.movement.setHoverTile(null);
      return;
    }

    const mode = args.actionBar.getMode();

    if (mode === "move") {
      args.movement.setHoverTile(hit);
      return;
    }

    if (mode === "attack") {
      if (!hit) return;
      if (selected.attackType !== "ranged") return;

      if (!isInBoundsAndNotCutout(hit.x, hit.y, args.cfg)) return;

      const range = Math.max(0, selected.attackRange);
      const dist = Math.abs(selected.x - hit.x) + Math.abs(selected.y - hit.y);
      if (dist < 1 || dist > range) return;

      const units = args.getUnits();

      if (selected.name === "scout") {
        const path = computeScoutProjectilePath(selected, hit, units);
        args.projectilePathOverlay.setPath(path);
        return;
      }

      const path = computeProjectilePath(selected, hit, units);
      args.projectilePathOverlay.setPath(path);
      return;
    }

    args.movement.setHoverTile(null);
  };

  return { applyMode, clearAll, handleHover };
}
