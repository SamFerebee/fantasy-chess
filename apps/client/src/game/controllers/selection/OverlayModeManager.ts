import type { BoardConfig } from "../../board/BoardConfig";
import type { UnitRenderer } from "../../units/UnitRenderer";
import type { MovementController } from "../../movement/MovementController";
import type { TurnController } from "../TurnController";
import type { ActionBar } from "../../ui/ActionBar";
import type { ActionMode } from "../../input/ActionMode";
import type { AttackRangeOverlay } from "../../combat/AttackRangeOverlay";
import type { ProjectilePathOverlay } from "../../combat/ProjectilePathOverlay";
import type { GameModel } from "../../sim/GameModel";

type Tile = { x: number; y: number } | null;

function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

export function createOverlayModeManager(args: {
  cfg: BoardConfig;
  model: GameModel;
  unitRenderer: UnitRenderer;
  turns: TurnController;
  movement: MovementController;
  actionBar: ActionBar;
  attackOverlay: AttackRangeOverlay;
  projectilePathOverlay: ProjectilePathOverlay;
}) {
  let attackTilesSet = new Set<string>();

  const cacheAttackTiles = (unitId: string | null) => {
    attackTilesSet = new Set<string>();
    if (!unitId) return;

    const tiles = args.model.getAttackableTiles(unitId, args.cfg);
    for (const t of tiles) attackTilesSet.add(tileKey(t.x, t.y));
  };

  const applyMode = (mode: ActionMode) => {
    const selectedId = args.unitRenderer.getSelectedUnitId();
    const selected = selectedId ? args.model.getUnitById(selectedId) : null;

    args.projectilePathOverlay.clear();
    attackTilesSet = new Set<string>();

    if (!selected || !args.turns.canControlUnit(selected)) {
      args.movement.setMoveRangeEnabled(false);
      args.movement.setHoverTile(null);
      args.attackOverlay.clear();
      return;
    }

    if (mode === "move") {
      args.attackOverlay.clear();
      args.movement.setMoveRangeEnabled(true, args.turns.getRemainingActionPoints(selected));
      args.movement.setHoverTile(null);
      return;
    }

    // attack mode
    args.movement.setHoverTile(null);
    args.movement.setMoveRangeEnabled(false);

    const tiles = args.model.getAttackableTiles(selected.id, args.cfg);
    args.attackOverlay.setTiles(tiles);
    cacheAttackTiles(selected.id);
  };

  const clearAll = () => {
    args.movement.setMoveRangeEnabled(false);
    args.movement.setHoverTile(null);
    args.attackOverlay.clear();
    args.projectilePathOverlay.clear();
    attackTilesSet = new Set<string>();
  };

  const handleHover = (hit: Tile) => {
    const selectedId = args.unitRenderer.getSelectedUnitId();
    const selected = selectedId ? args.model.getUnitById(selectedId) : null;

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

      // Use authoritative derived data (sim) rather than recomputing range rules here.
      if (!attackTilesSet.has(tileKey(hit.x, hit.y))) return;

      const path = args.model.getProjectilePreviewPath(selected.id, hit);
      if (path && path.length > 0) args.projectilePathOverlay.setPath(path);
      return;
    }

    args.movement.setHoverTile(null);
  };

  return { applyMode, clearAll, handleHover };
}
