import type { UncertaintySpec } from "@/types/dataset";
import { finiteValues, mean } from "./statistics";

/**
 * Measurement-uncertainty helpers.
 *
 * An uncertainty is specified per column either as an absolute value
 * (± δ in the column's unit) or as a percentage of each reading.
 */

export function isValidUncertainty(spec: UncertaintySpec | null | undefined): spec is UncertaintySpec {
  return !!spec && Number.isFinite(spec.value) && spec.value > 0;
}

/**
 * Absolute uncertainty for every value of a column (same length as `values`).
 * Missing values get NaN. Returns null when no valid uncertainty is set.
 */
export function absoluteUncertainties(values: readonly number[], spec: UncertaintySpec | null): number[] | null {
  if (!isValidUncertainty(spec)) return null;
  return values.map((v) => {
    if (!Number.isFinite(v)) return NaN;
    return spec.kind === "absolute" ? spec.value : (Math.abs(v) * spec.value) / 100;
  });
}

export interface PercentUncertaintySummary {
  /** δ / |x̄| × 100, the uncertainty relative to the mean reading. */
  relativeToMean: number;
  /** Smallest and largest per-reading percent uncertainty (zeros excluded). */
  min: number;
  max: number;
  /** Absolute uncertainty at the mean reading, in the column's unit. */
  absoluteAtMean: number;
}

/**
 * Percent (relative) uncertainty, δ/|x| × 100 %.
 *
 * For an absolute uncertainty the percentage differs from reading to reading,
 * so we report it relative to the mean and the min–max over the readings.
 * Readings equal to zero have an undefined percent uncertainty and are
 * excluded from the min / max.
 */
export function percentUncertainty(values: readonly number[], spec: UncertaintySpec | null): PercentUncertaintySummary | null {
  if (!isValidUncertainty(spec)) return null;
  const xs = finiteValues(values);
  const m = mean(xs);
  if (spec.kind === "percent") {
    return {
      relativeToMean: spec.value,
      min: spec.value,
      max: spec.value,
      absoluteAtMean: (Math.abs(m) * spec.value) / 100,
    };
  }
  const perReading = xs.filter((v) => v !== 0).map((v) => (spec.value / Math.abs(v)) * 100);
  return {
    relativeToMean: m === 0 || !Number.isFinite(m) ? NaN : (spec.value / Math.abs(m)) * 100,
    min: perReading.length ? Math.min(...perReading) : NaN,
    max: perReading.length ? Math.max(...perReading) : NaN,
    absoluteAtMean: spec.value,
  };
}

export interface ChiSquareResult {
  chiSquare: number;
  degreesOfFreedom: number;
  /** χ²/ν. Values near 1 mean the scatter matches the stated uncertainties. */
  reduced: number;
}

/**
 * χ² = Σ (rᵢ / σᵢ)² with ν = n − p degrees of freedom.
 *
 * Only meaningful when every point has a positive uncertainty σᵢ, and
 * undefined when n ≤ p. Returns null in those cases.
 */
export function chiSquare(residuals: readonly number[], sigmas: readonly number[], paramCount: number): ChiSquareResult | null {
  if (residuals.length !== sigmas.length) return null;
  const n = residuals.length;
  const dof = n - paramCount;
  if (dof < 1) return null;
  let chi2 = 0;
  for (let i = 0; i < n; i++) {
    const s = sigmas[i];
    if (!Number.isFinite(s) || s <= 0 || !Number.isFinite(residuals[i])) return null;
    chi2 += (residuals[i] / s) ** 2;
  }
  return { chiSquare: chi2, degreesOfFreedom: dof, reduced: chi2 / dof };
}
