import type { TileOverlay } from "../board/TileOverlay";
import type { GameModel } from "../sim/GameModel";
import type { RenderStateStore } from "../render/RenderStateStore";
import type { UnitRenderer } from "../units/UnitRenderer";
import type { MovementController } from "../movement/MovementController";
import type { SnapshotSyncMessage } from "./NetMessages";

/**
 * Single entrypoint for applying an authoritative server snapshot sync.
 *
 * Contract:
 * - stop/clear client-side movement tweens/locks
 * - restore sim from snapshot
 * - rebuild render state from snapshot
 * - clear selection if selected unit no longer exists
 */
export class SnapshotSyncClient {
  private model: GameModel;
  private renderStore: RenderStateStore;
  private unitRenderer: UnitRenderer;
  private movement: MovementController;
  private overlay: TileOverlay;
  private onAfterSync?: () => void;

  constructor(args: {
    model: GameModel;
    renderStore: RenderStateStore;
    unitRenderer: UnitRenderer;
    movement: MovementController;
    overlay: TileOverlay;
    onAfterSync?: () => void;
  }) {
    this.model = args.model;
    this.renderStore = args.renderStore;
    this.unitRenderer = args.unitRenderer;
    this.movement = args.movement;
    this.overlay = args.overlay;
    this.onAfterSync = args.onAfterSync;
  }

  apply(msg: SnapshotSyncMessage) {
    // Stop client-side visuals that would fight the authoritative snap.
    if (this.movement.isAnimatingMove()) {
      this.movement.cancelInFlightMove();
    } else {
      this.unitRenderer.resetVisualAnimations();
    }

    // Apply authoritative world
    this.model.restoreFromSnapshot(msg.snapshot);
    this.renderStore.applySnapshot(msg.snapshot);

    // Snap visuals to store immediately
    this.unitRenderer.forceSyncFromStore();

    // Clear selection if selected unit no longer exists
    const selId = this.unitRenderer.getSelectedUnitId();
    if (selId && !this.renderStore.getUnit(selId)) {
      this.unitRenderer.setSelectedUnitId(null);
      this.overlay.setSelected(null);
      this.movement.setSelectedUnitId(null);
      this.movement.setHoverTile(null);
    }

    this.onAfterSync?.();
  }
}
