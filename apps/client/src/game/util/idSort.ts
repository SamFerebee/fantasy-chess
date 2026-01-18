/**
 * Stable ordering for authoritative IDs.
 *
 * Expected unit ids: "A1", "A2", "B10", etc.
 * Sort by team letter then numeric suffix (natural sort),
 * with a fallback to plain string compare.
 */
export function compareUnitId(a: string, b: string): number {
  if (a === b) return 0;

  const pa = parseUnitId(a);
  const pb = parseUnitId(b);

  if (pa && pb) {
    if (pa.prefix !== pb.prefix) return pa.prefix < pb.prefix ? -1 : 1;
    if (pa.num !== pb.num) return pa.num - pb.num;
  }

  return a < b ? -1 : 1;
}

function parseUnitId(id: string): { prefix: string; num: number } | null {
  if (!id || id.length < 2) return null;
  const prefix = id[0];
  const rest = id.slice(1);
  const num = Number.parseInt(rest, 10);
  if (!Number.isFinite(num)) return null;
  if (!/^[0-9]+$/.test(rest)) return null;
  return { prefix, num };
}
