import type { DescriptiveStats } from "@/types/analysis";

/**
 * Descriptive statistics.
 *
 * Conventions used throughout:
 *  - Non-finite inputs (NaN, ±Infinity) are treated as missing and ignored.
 *  - A quantity that is mathematically undefined for the given data
 *    (e.g. the mean of an empty list, the sample standard deviation of a
 *    single point) is returned as NaN rather than a misleading 0.
 */

/** Keep only finite numbers. */
export function finiteValues(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of values) {
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

/**
 * Sum using Neumaier's compensated summation. A naive running sum loses
 * precision when adding many values of very different magnitude; this keeps
 * a correction term for the low-order bits that would otherwise be lost.
 * Non-finite values are skipped.
 */
export function sum(values: readonly number[]): number {
  let total = 0;
  let compensation = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    const t = total + v;
    if (Math.abs(total) >= Math.abs(v)) {
      compensation += total - t + v;
    } else {
      compensation += v - t + total;
    }
    total = t;
  }
  return total + compensation;
}

/** Arithmetic mean of the finite values. NaN for an empty input. */
export function mean(values: readonly number[]): number {
  const xs = finiteValues(values);
  if (xs.length === 0) return NaN;
  return sum(xs) / xs.length;
}

/** Median of the finite values. NaN for an empty input. */
export function median(values: readonly number[]): number {
  const xs = finiteValues(values).sort((a, b) => a - b);
  const n = xs.length;
  if (n === 0) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

export function min(values: readonly number[]): number {
  let best = Infinity;
  let found = false;
  for (const v of values) {
    if (Number.isFinite(v)) {
      found = true;
      if (v < best) best = v;
    }
  }
  return found ? best : NaN;
}

export function max(values: readonly number[]): number {
  let best = -Infinity;
  let found = false;
  for (const v of values) {
    if (Number.isFinite(v)) {
      found = true;
      if (v > best) best = v;
    }
  }
  return found ? best : NaN;
}

/**
 * Sample variance s² = Σ(xᵢ − x̄)² / (n − 1).
 *
 * Uses the two-pass algorithm (compute the mean first, then the squared
 * deviations) which avoids the catastrophic cancellation of the textbook
 * "Σx² − n·x̄²" formula when the mean is large compared to the spread
 * (e.g. temperatures in kelvin, or timestamps).
 *
 * Returns NaN when fewer than two finite values are available.
 */
export function variance(values: readonly number[]): number {
  const xs = finiteValues(values);
  const n = xs.length;
  if (n < 2) return NaN;
  const m = sum(xs) / n;
  const squaredDeviations = xs.map((x) => (x - m) * (x - m));
  return sum(squaredDeviations) / (n - 1);
}

/** Sample standard deviation s = √(s²). NaN when n < 2. */
export function standardDeviation(values: readonly number[]): number {
  return Math.sqrt(variance(values));
}

/** Standard error of the mean, s / √n. NaN when n < 2. */
export function standardError(values: readonly number[]): number {
  const n = finiteValues(values).length;
  if (n < 2) return NaN;
  return standardDeviation(values) / Math.sqrt(n);
}

/** All descriptive statistics for a column in one pass over the API. */
export function describe(values: readonly number[]): DescriptiveStats {
  const xs = finiteValues(values);
  const lo = min(xs);
  const hi = max(xs);
  return {
    n: xs.length,
    missing: values.length - xs.length,
    mean: mean(xs),
    median: median(xs),
    min: lo,
    max: hi,
    range: hi - lo,
    stdDev: standardDeviation(xs),
    stdError: standardError(xs),
  };
}
