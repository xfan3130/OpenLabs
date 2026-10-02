/**
 * Deterministic pseudo-random numbers, so built-in sample datasets are
 * identical on every load (a teacher and their students see the same data).
 */

/** Mulberry32: a small, fast 32-bit PRNG returning values in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard normal deviates via the Box–Muller transform:
 * z = √(−2 ln u₁) · cos(2π u₂) for independent uniform u₁, u₂ ∈ (0, 1].
 */
export function gaussian(rng: () => number): () => number {
  return () => {
    const u1 = 1 - rng(); // (0, 1], avoids log(0)
    const u2 = rng();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
}

/** Round to a fixed number of decimals, like an instrument's display. */
export function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}
