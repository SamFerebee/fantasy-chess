import type { TileCoord } from "../../movement/path";

export type MicroNode =
  | { k: "T"; x: number; y: number } // tile center
  | { k: "EV"; x: number; y: number } // vertical edge between tiles (x,y) and (x+1,y)
  | { k: "EH"; x: number; y: number } // horizontal edge between tiles (x,y) and (x,y+1)
  | { k: "C"; x: number; y: number }; // corner point at grid intersection (x,y)

export type GridPoint = { x: number; y: number };

export function nodeToPoint(n: MicroNode): GridPoint {
  switch (n.k) {
    case "T":
      return { x: n.x + 0.5, y: n.y + 0.5 };
    case "EV":
      return { x: n.x + 1.0, y: n.y + 0.5 };
    case "EH":
      return { x: n.x + 0.5, y: n.y + 1.0 };
    case "C":
      return { x: n.x, y: n.y };
  }
}

function nodeKey(n: MicroNode): string {
  return `${n.k}:${n.x},${n.y}`;
}

function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function findScoutMicroLanePath(args: {
  attacker: TileCoord;
  aim: TileCoord;
  occupiedTiles: Set<string>;
  maxRange: number;
}): MicroNode[] | null {
  const { attacker, aim, occupiedTiles, maxRange } = args;

  const dist = manhattan(attacker.x, attacker.y, aim.x, aim.y);
  if (dist < 1 || dist > maxRange) return null;

  // Region clamp: bounding box between attacker & aim expanded by 2.
  // Expansion=1 is often too tight for real "threading" cases where a seam path
  // must briefly step around an adjacent blocker. Expansion=2 still prevents
  // broad detours but significantly improves coverage of intended shots.
  const EXPAND = 2;
  const minX = Math.min(attacker.x, aim.x) - EXPAND;
  const maxX = Math.max(attacker.x, aim.x) + EXPAND;
  const minY = Math.min(attacker.y, aim.y) - EXPAND;
  const maxY = Math.max(attacker.y, aim.y) + EXPAND;

  const inTileBounds = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;
  const inCornerBounds = (x: number, y: number) => x >= minX && x <= maxX + 1 && y >= minY && y <= maxY + 1;

  const start: MicroNode = { k: "T", x: attacker.x, y: attacker.y };
  const goal: MicroNode = { k: "T", x: aim.x, y: aim.y };

  // Steps cap: seam paths should be short, but corner/edge graphs can require extra hops.
  // Keep bounded for determinism and to avoid "go around" behavior.
  const maxSteps = Math.min(256, dist * 12 + 32);

  const canEnterTileCenter = (x: number, y: number): boolean => {
    if (!inTileBounds(x, y)) return false;
    if (x === attacker.x && y === attacker.y) return true;
    if (x === aim.x && y === aim.y) return true;
    return !occupiedTiles.has(tileKey(x, y));
  };

  const canUseEV = (x: number, y: number): boolean => {
    return inTileBounds(x, y) || inTileBounds(x + 1, y);
  };

  const canUseEH = (x: number, y: number): boolean => {
    return inTileBounds(x, y) || inTileBounds(x, y + 1);
  };

  const canUseCorner = (x: number, y: number): boolean => {
    return inCornerBounds(x, y);
  };

  const neighbors = (n: MicroNode): MicroNode[] => {
    switch (n.k) {
      case "T": {
        const out: MicroNode[] = [];
        if (canUseEV(n.x, n.y)) out.push({ k: "EV", x: n.x, y: n.y });
        if (canUseEV(n.x - 1, n.y)) out.push({ k: "EV", x: n.x - 1, y: n.y });
        if (canUseEH(n.x, n.y)) out.push({ k: "EH", x: n.x, y: n.y });
        if (canUseEH(n.x, n.y - 1)) out.push({ k: "EH", x: n.x, y: n.y - 1 });
        return out;
      }

      case "EV": {
        const out: MicroNode[] = [];
        if (canEnterTileCenter(n.x, n.y)) out.push({ k: "T", x: n.x, y: n.y });
        if (canEnterTileCenter(n.x + 1, n.y)) out.push({ k: "T", x: n.x + 1, y: n.y });

        const cx = n.x + 1;
        const c0y = n.y;
        const c1y = n.y + 1;

        if (canUseCorner(cx, c0y)) out.push({ k: "C", x: cx, y: c0y });
        if (canUseCorner(cx, c1y)) out.push({ k: "C", x: cx, y: c1y });

        return out;
      }

      case "EH": {
        const out: MicroNode[] = [];
        if (canEnterTileCenter(n.x, n.y)) out.push({ k: "T", x: n.x, y: n.y });
        if (canEnterTileCenter(n.x, n.y + 1)) out.push({ k: "T", x: n.x, y: n.y + 1 });

        const cy = n.y + 1;
        const c0x = n.x;
        const c1x = n.x + 1;

        if (canUseCorner(c0x, cy)) out.push({ k: "C", x: c0x, y: cy });
        if (canUseCorner(c1x, cy)) out.push({ k: "C", x: c1x, y: cy });

        return out;
      }

      case "C": {
        const out: MicroNode[] = [];
        const cx = n.x;
        const cy = n.y;

        const ev0 = { x: cx - 1, y: cy - 1 };
        const ev1 = { x: cx - 1, y: cy };
        const eh0 = { x: cx - 1, y: cy - 1 };
        const eh1 = { x: cx, y: cy - 1 };

        if (canUseEV(ev0.x, ev0.y)) out.push({ k: "EV", x: ev0.x, y: ev0.y });
        if (canUseEV(ev1.x, ev1.y)) out.push({ k: "EV", x: ev1.x, y: ev1.y });
        if (canUseEH(eh0.x, eh0.y)) out.push({ k: "EH", x: eh0.x, y: eh0.y });
        if (canUseEH(eh1.x, eh1.y)) out.push({ k: "EH", x: eh1.x, y: eh1.y });

        return out;
      }
    }
  };

  const q: MicroNode[] = [start];
  const seen = new Set<string>([nodeKey(start)]);
  const prev = new Map<string, string>();
  const nodeByKey = new Map<string, MicroNode>([[nodeKey(start), start]]);

  let expansions = 0;

  while (q.length > 0 && expansions < maxSteps) {
    expansions++;

    const cur = q.shift()!;
    const curKey = nodeKey(cur);

    if (cur.k === "T" && cur.x === goal.x && cur.y === goal.y) {
      const pathKeys: string[] = [];
      let k: string | undefined = curKey;
      while (k) {
        pathKeys.push(k);
        k = prev.get(k);
      }
      pathKeys.reverse();

      const path: MicroNode[] = [];
      for (const pk of pathKeys) {
        const nn = nodeByKey.get(pk);
        if (nn) path.push(nn);
      }
      return path;
    }

    const ns = neighbors(cur);
    for (const nxt of ns) {
      const nk = nodeKey(nxt);
      if (seen.has(nk)) continue;
      seen.add(nk);
      prev.set(nk, curKey);
      nodeByKey.set(nk, nxt);
      q.push(nxt);
    }
  }

  return null;
}

export function microPathToTilePath(nodes: MicroNode[]): TileCoord[] {
  const out: TileCoord[] = [];
  const seen = new Set<string>();

  for (const n of nodes) {
    if (n.k === "T") {
      const k = tileKey(n.x, n.y);
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ x: n.x, y: n.y });
      }
    }
  }

  return out;
}

export function microPathToPolyline(nodes: MicroNode[]): GridPoint[] {
  return nodes.map(nodeToPoint);
}
