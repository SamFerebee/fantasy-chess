import type { TileCoord } from "../../movement/path";

export type RelativePath = ReadonlyArray<TileCoord>;

function relKey(path: TileCoord[]): string {
  return path.map((p) => `${p.x},${p.y}`).join("|");
}

function sign(n: number): 1 | -1 {
  return n >= 0 ? 1 : -1;
}

function countAlternations(steps: ReadonlyArray<"x" | "y">): number {
  let a = 0;
  for (let i = 1; i < steps.length; i++) {
    if (steps[i] !== steps[i - 1]) a++;
  }
  return a;
}

/**
 * Generate ALL unique interleavings of ax "x" steps and ay "y" steps.
 * With manhattan range <= 6, (ax+ay) <= 6 so this is very small (max 20 sequences).
 */
function generateStepSequences(ax: number, ay: number): Array<Array<"x" | "y">> {
  const out: Array<Array<"x" | "y">> = [];

  const rec = (xsLeft: number, ysLeft: number, cur: Array<"x" | "y">) => {
    if (xsLeft === 0 && ysLeft === 0) {
      out.push(cur.slice());
      return;
    }
    if (xsLeft > 0) {
      cur.push("x");
      rec(xsLeft - 1, ysLeft, cur);
      cur.pop();
    }
    if (ysLeft > 0) {
      cur.push("y");
      rec(xsLeft, ysLeft - 1, cur);
      cur.pop();
    }
  };

  rec(ax, ay, []);

  // Deterministic order: prefer straighter lanes (fewer alternations), then lexical.
  out.sort((a, b) => {
    const da = countAlternations(a);
    const db = countAlternations(b);
    if (da !== db) return da - db;

    const sa = a.join("");
    const sb = b.join("");
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });

  return out;
}

function buildPathsForDelta(dx: number, dy: number): RelativePath[] {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const sx = sign(dx);
  const sy = sign(dy);

  const sequences = generateStepSequences(ax, ay);
  const dedupe = new Map<string, TileCoord[]>();

  for (const seq of sequences) {
    let x = 0;
    let y = 0;
    const path: TileCoord[] = [{ x: 0, y: 0 }];
    for (const s of seq) {
      if (s === "x") x += sx;
      else y += sy;
      path.push({ x, y });
    }

    const last = path[path.length - 1];
    if (last.x !== dx || last.y !== dy) continue;

    const k = relKey(path);
    if (!dedupe.has(k)) dedupe.set(k, path);
  }

  return Array.from(dedupe.values());
}

/**
 * Scout lane library:
 * For each (dx,dy) within manhattan range R, we precompute all shortest monotone tile paths
 * (all step-order interleavings of X/Y moves).
 */
export class ScoutLaneLibrary {
  private readonly byDelta = new Map<string, RelativePath[]>();
  readonly maxRange: number;

  constructor(maxRange: number) {
    this.maxRange = maxRange;
    this.build();
  }

  get(dx: number, dy: number): ReadonlyArray<RelativePath> {
    return this.byDelta.get(`${dx},${dy}`) ?? [];
  }

  private build() {
    const R = this.maxRange;
    for (let dx = -R; dx <= R; dx++) {
      for (let dy = -R; dy <= R; dy++) {
        if (dx === 0 && dy === 0) continue;
        if (Math.abs(dx) + Math.abs(dy) > R) continue;

        const paths = buildPathsForDelta(dx, dy);
        if (paths.length > 0) this.byDelta.set(`${dx},${dy}`, paths);
      }
    }
  }
}

// Singleton library for current Scout max range. If you change range, update this constant.
export const SCOUT_LANES = new ScoutLaneLibrary(6);
