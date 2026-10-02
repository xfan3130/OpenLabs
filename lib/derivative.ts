/**
 * Numerical differentiation of sampled data, dy/dx ≈ finite differences.
 *
 * Lab data is often unevenly spaced (a stopwatch is not a metronome), so we
 * use the non-uniform three-point formulas, which reduce to the familiar
 * textbook formulas when the spacing is constant.
 *
 * With h₁ = xᵢ − xᵢ₋₁ and h₂ = xᵢ₊₁ − xᵢ:
 *
 *  interior (central difference, second-order accurate):
 *    y'ᵢ ≈ −h₂/(h₁(h₁+h₂))·yᵢ₋₁ + (h₂−h₁)/(h₁h₂)·yᵢ + h₁/(h₂(h₁+h₂))·yᵢ₊₁
 *    (uniform h:  (yᵢ₊₁ − yᵢ₋₁) / 2h)
 *
 *  first point (one-sided, second-order), h₁ = x₁ − x₀, h₂ = x₂ − x₁:
 *    y'₀ ≈ −(2h₁+h₂)/(h₁(h₁+h₂))·y₀ + (h₁+h₂)/(h₁h₂)·y₁ − h₁/(h₂(h₁+h₂))·y₂
 *    (uniform h:  (−3y₀ + 4y₁ − y₂) / 2h)
 *
 *  last point: the mirror image of the first-point formula.
 *
 * All three formulas are exact for quadratics, so the derivative of
 * x = ½at² sampled without noise is exactly v = at at every point.
 * With only two points the single forward difference is used.
 */

export type DerivativeOutcome =
  | { ok: true; values: number[]; warnings: string[] }
  | { ok: false; error: string };

/**
 * Derivative of y with respect to x for data already sorted by strictly
 * increasing x. Both arrays must be finite and of equal length ≥ 2.
 * Callers that cannot guarantee this should use `numericalDerivative`.
 */
export function derivativeOfSorted(x: readonly number[], y: readonly number[]): number[] {
  const n = x.length;
  if (n !== y.length) throw new Error("x and y must have the same length");
  if (n < 2) throw new Error("at least two points are required");
  const d = new Array<number>(n);

  if (n === 2) {
    const slope = (y[1] - y[0]) / (x[1] - x[0]);
    d[0] = slope;
    d[1] = slope;
    return d;
  }

  // First point: second-order forward difference.
  {
    const h1 = x[1] - x[0];
    const h2 = x[2] - x[1];
    d[0] =
      (-(2 * h1 + h2) / (h1 * (h1 + h2))) * y[0] +
      ((h1 + h2) / (h1 * h2)) * y[1] -
      (h1 / (h2 * (h1 + h2))) * y[2];
  }

  // Interior points: second-order central difference.
  for (let i = 1; i < n - 1; i++) {
    const h1 = x[i] - x[i - 1];
    const h2 = x[i + 1] - x[i];
    d[i] =
      (-h2 / (h1 * (h1 + h2))) * y[i - 1] +
      ((h2 - h1) / (h1 * h2)) * y[i] +
      (h1 / (h2 * (h1 + h2))) * y[i + 1];
  }

  // Last point: second-order backward difference.
  {
    const h1 = x[n - 2] - x[n - 3];
    const h2 = x[n - 1] - x[n - 2];
    d[n - 1] =
      (h2 / (h1 * (h1 + h2))) * y[n - 3] -
      ((h1 + h2) / (h1 * h2)) * y[n - 2] +
      ((2 * h2 + h1) / (h2 * (h1 + h2))) * y[n - 1];
  }

  return d;
}

/**
 * Derivative dy/dx for two dataset columns (NaN = missing).
 *
 *  - Rows where x or y is missing are skipped and get NaN in the output.
 *  - If the rows are not in increasing x order they are sorted first; the
 *    result is still returned in the original row order.
 *  - Repeated x values make the derivative undefined (division by zero),
 *    so they are reported as an error rather than producing Infinity.
 */
export function numericalDerivative(x: readonly number[], y: readonly number[]): DerivativeOutcome {
  if (x.length !== y.length) {
    return { ok: false, error: "The two columns have different lengths." };
  }
  const points: { x: number; y: number; row: number }[] = [];
  for (let i = 0; i < x.length; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) points.push({ x: x[i], y: y[i], row: i });
  }
  if (points.length < 2) {
    return {
      ok: false,
      error: `A derivative needs at least 2 rows with both values present (found ${points.length}).`,
    };
  }

  const warnings: string[] = [];
  const wasSorted = points.every((p, i) => i === 0 || points[i - 1].x <= p.x);
  if (!wasSorted) {
    points.sort((a, b) => a.x - b.x);
    warnings.push("Rows were not in increasing x order; the derivative was computed after sorting by x.");
  }
  for (let i = 1; i < points.length; i++) {
    if (points[i].x === points[i - 1].x) {
      return {
        ok: false,
        error: `The x value ${points[i].x} appears more than once, so the derivative is undefined there (division by zero).`,
      };
    }
  }

  const skipped = x.length - points.length;
  if (skipped > 0) {
    warnings.push(`${skipped} row${skipped === 1 ? "" : "s"} with missing values ${skipped === 1 ? "was" : "were"} left blank.`);
  }

  const d = derivativeOfSorted(
    points.map((p) => p.x),
    points.map((p) => p.y),
  );
  const values = new Array<number>(x.length).fill(NaN);
  points.forEach((p, i) => {
    values[p.row] = d[i];
  });
  return { ok: true, values, warnings };
}
