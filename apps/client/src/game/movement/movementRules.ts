import type { BoardConfig } from "../board/BoardConfig";
import type { Unit } from "../units/UnitTypes";
import type { TileCoord } from "./path";
import { computeReachableTiles } from "./reachable";

export function keyXY(x: number, y: number) {
  return `${x},${y}`;
}

export function buildBlockedSet(units: Unit[], selectedUnitId: string): Set<string> {
  const blocked = new Set<string>();
  for (const u of units) {
    if (u.id === selectedUnitId) continue;
    blocked.add(keyXY(u.x, u.y));
  }
  return blocked;
}

export function isInBoundsAndNotCutout(cfg: BoardConfig, t: TileCoord): boolean {
  const { cols, rows, cornerCut } = cfg;

  if (t.x < 0 || t.y < 0 || t.x >= cols || t.y >= rows) return false;
  if (cornerCut <= 0) return true;

  if (t.x < cornerCut && t.y < cornerCut) return false;
  if (t.x >= cols - cornerCut && t.y < cornerCut) return false;
  if (t.x < cornerCut && t.y >= rows - cornerCut) return false;
  if (t.x >= cols - cornerCut && t.y >= rows - cornerCut) return false;

  return true;
}

export function computeReachableKeySet(args: {
  cfg: BoardConfig;
  selected: Unit;
  units: Unit[];
}): Set<string> {
  const blocked = buildBlockedSet(args.units, args.selected.id);

  const tiles = computeReachableTiles({
    cfg: args.cfg,
    start: { x: args.selected.x, y: args.selected.y },
    moveRange: args.selected.moveRange,
    blocked,
  });

  const s = new Set<string>();
  for (const t of tiles) s.add(keyXY(t.x, t.y));
  s.add(keyXY(args.selected.x, args.selected.y));
  return s;
}
