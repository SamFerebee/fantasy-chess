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
import { isInBoundsAndNotCutout } from "../../movement/movementRules";

type Tile = { x: number; y: number } | null;

function getPrimaryRange(u: Unit): number {
  const atk = u.attack;
  switch (atk.kind) {
    case "melee_adjacent":
      return 1;

    case "projectile_blockable_single":
    case "projectile_unblockable_single":
    case "line_hit_all":
      return Math.max(0, atk.range);

    case "pattern_shot":
      return Math.max(0, atk.maxRange);

    case "quake_aoe":
      return 0;
  }
}

function shouldShowProjectilePath(u: Unit): boolean {
  const k = u.attack.kind;
  return (
    k === "projectile_blockable_single" ||
    k === "projectile_unblockable_single" ||
    k === "line_hit_all" ||
    k === "pattern_shot"
  );
}

function projectilePathStopOnUnit(u: Unit): boolean {
  // Current preview behavior:
  // - blockable projectile stops on first unit
  // - unblockable / line / pattern do not stop (preview full line for now)
  return u.attack.kind === "projectile_blockable_single";
}

export function createOverlayModeManager(args: {
  cfg: BoardConfig;
  units: Unit[];
  unitRenderer: UnitRenderer;
  turns: TurnController;
  movement: MovementController;
  actionBar: ActionBar;
  attackOverlay: AttackRangeOverlay;
  projectilePathOverlay: ProjectilePathOverlay;
}) {
  const applyMode = (mode: ActionMode) => {
    const selected = args.unitRenderer.getSelectedUnit();

    // Always clear projectile path unless we are actively in attack mode with a ranged-style preview
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

    // attack mode
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

    // Default: clear projectile path unless we redraw it below
    args.projectilePathOverlay.clear();

    if (!selected || !args.turns.canActWithUnit(selected)) {
      args.movement.setHoverTile(null);
      return;
    }

    const mode = args.actionBar.getMode();

    // Move hover/path preview
    if (mode === "move") {
      args.movement.setHoverTile(hit);
      return;
    }

    // Attack hover: only certain attacks get a path preview
    if (mode === "attack") {
      if (!hit) return;
      if (!shouldShowProjectilePath(selected)) return;

      // must be in bounds and within range gate (for now, Manhattan)
      if (!isInBoundsAndNotCutout(hit.x, hit.y, args.cfg)) return;

      const range = getPrimaryRange(selected);
      const dist = Math.abs(selected.x - hit.x) + Math.abs(selected.y - hit.y);
      if (dist < 1 || dist > range) return;

      const stopOnUnit = projectilePathStopOnUnit(selected);
      const path = computeProjectilePath(selected, hit, args.units, { stopOnUnit });
      args.projectilePathOverlay.setPath(path);
      return;
    }

    // fallback
    args.movement.setHoverTile(null);
  };

  return { applyMode, clearAll, handleHover };
}
