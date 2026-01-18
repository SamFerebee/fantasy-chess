export type RngSnapshot = {
  /** Algorithm id so we can migrate later without breaking replays. */
  alg: "mulberry32";
  /** Current internal 32-bit state. */
  state: number;
};

/**
 * Deterministic, seedable RNG.
 *
 * Intended for later server-authoritative play:
 * - can be snapshotted/restored
 * - produces the same sequence across client/server
 */
export class DeterministicRng {
  private state: number;

  constructor(seedOrSnapshot: number | RngSnapshot) {
    if (typeof seedOrSnapshot === "number") {
      this.state = seedOrSnapshot >>> 0;
    } else {
      if (seedOrSnapshot.alg !== "mulberry32") {
        throw new Error(`Unsupported RNG alg: ${String((seedOrSnapshot as any).alg)}`);
      }
      this.state = seedOrSnapshot.state >>> 0;
    }

    // mulberry32 has a degenerate state at 0; avoid it.
    if (this.state === 0) this.state = 0x12345678;
  }

  snapshot(): RngSnapshot {
    return { alg: "mulberry32", state: this.state >>> 0 };
  }

  /** Returns a uint32 in [0, 2^32). */
  nextUint32(): number {
    // mulberry32 step
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) as number;
  }

  /** Returns a float in [0, 1). */
  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Returns an int in [0, maxExclusive). */
  nextInt(maxExclusive: number): number {
    const m = Math.floor(maxExclusive);
    if (!(m > 0)) return 0;
    // Mod-bias is acceptable for gameplay; can be upgraded to rejection sampling later.
    return this.nextUint32() % m;
  }
}
