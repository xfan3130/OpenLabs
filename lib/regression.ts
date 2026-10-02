import type { AxisRange, RegressionModel } from "@/types/dataset";
import type { FitOutcome, FitParameter, FitResult } from "@/types/analysis";
import { binomial, matMul, solveLeastSquares, transpose } from "./linalg";
import { sum } from "./statistics";

/**
 * Least-squares regression for the four models OpenLab supports.
 *
 *   linear       y = m·x + b          ordinary least squares (closed form)
 *   quadratic    y = a·x² + b·x + c   polynomial least squares (QR)
 *   exponential  y = A·e^(B·x)        linear least squares on ln(y) vs x
 *   power        y = A·x^B            linear least squares on ln(y) vs ln(x)
 *
 * Every function validates its input and returns a descriptive error
 * instead of producing NaN coefficients.
 */

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface ModelInfo {
  label: string;
  /** Generic form shown in the UI. */
  form: string;
  /** Parameters in display order. */
  params: { symbol: string; name: string }[];
}

export const MODEL_INFO: Record<RegressionModel, ModelInfo> = {
  linear: {
    label: "Linear",
    form: "y = mx + b",
    params: [
      { symbol: "m", name: "slope" },
      { symbol: "b", name: "intercept" },
    ],
  },
  quadratic: {
    label: "Quadratic",
    form: "y = ax² + bx + c",
    params: [
      { symbol: "a", name: "x² coefficient" },
      { symbol: "b", name: "x coefficient" },
      { symbol: "c", name: "constant" },
    ],
  },
  exponential: {
    label: "Exponential",
    form: "y = A·e^(Bx)",
    params: [
      { symbol: "A", name: "amplitude" },
      { symbol: "B", name: "rate constant" },
    ],
  },
  power: {
    label: "Power law",
    form: "y = A·x^B",
    params: [
      { symbol: "A", name: "coefficient" },
      { symbol: "B", name: "exponent" },
    ],
  },
};

export const REGRESSION_MODELS: RegressionModel[] = ["linear", "quadratic", "exponential", "power"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pairs (xᵢ, yᵢ) where both values are finite, with their original indices. */
export function finitePairs(x: readonly number[], y: readonly number[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  const indices: number[] = [];
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(x[i]) && Number.isFinite(y[i])) {
      xs.push(x[i]);
      ys.push(y[i]);
      indices.push(i);
    }
  }
  return { x: xs, y: ys, indices };
}

function countDistinct(values: readonly number[]): number {
  return new Set(values).size;
}

/**
 * Coefficient of determination R² = 1 − SS_res / SS_tot, where
 * SS_res = Σ(yᵢ − ŷᵢ)² and SS_tot = Σ(yᵢ − ȳ)².
 *
 * Only pairs where both the observation and the prediction are finite are
 * used. R² is undefined (NaN) when there are fewer than 2 such points or when
 * every y is identical (SS_tot = 0).
 */
export function rSquared(observed: readonly number[], predicted: readonly number[]): number {
  if (observed.length !== predicted.length) return NaN;
  const pairs = finitePairs(observed, predicted);
  const n = pairs.x.length;
  if (n < 2) return NaN;
  const yBar = sum(pairs.x) / n;
  const ssTot = sum(pairs.x.map((y) => (y - yBar) ** 2));
  if (ssTot === 0) return NaN;
  const ssRes = sum(pairs.x.map((y, i) => (y - pairs.y[i]) ** 2));
  return 1 - ssRes / ssTot;
}

/** Evaluate a polynomial with coefficients in ascending order (c₀ + c₁x + …) using Horner's rule. */
export function evaluatePolynomial(ascending: readonly number[], x: number): number {
  let result = 0;
  for (let k = ascending.length - 1; k >= 0; k--) result = result * x + ascending[k];
  return result;
}

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------

export interface LinearFit {
  slope: number;
  intercept: number;
  slopeStdError: number;
  interceptStdError: number;
  rSquared: number;
  sse: number;
  n: number;
}

/**
 * Ordinary least-squares straight line y = m·x + b.
 *
 * Uses centred sums, which are numerically safer than the raw-sum formulas:
 *   Sxx = Σ(xᵢ − x̄)²,  Sxy = Σ(xᵢ − x̄)(yᵢ − ȳ)
 *   m = Sxy / Sxx,     b = ȳ − m·x̄
 *
 * Standard errors (valid when n > 2) follow from the residual variance
 * s² = SSE / (n − 2):
 *   SE(m) = s / √Sxx,  SE(b) = s · √(1/n + x̄² / Sxx)
 */
export function linearRegression(x: readonly number[], y: readonly number[]): Result<LinearFit> {
  if (x.length !== y.length) return { ok: false, error: "x and y must have the same length." };
  const p = finitePairs(x, y);
  const n = p.x.length;
  if (n < 2) {
    return { ok: false, error: `Linear regression needs at least 2 data points (found ${n}).` };
  }
  const xBar = sum(p.x) / n;
  const yBar = sum(p.y) / n;
  const sxx = sum(p.x.map((xi) => (xi - xBar) ** 2));
  if (countDistinct(p.x) < 2 || sxx === 0) {
    return { ok: false, error: "All x values are identical, so the slope is undefined." };
  }
  const sxy = sum(p.x.map((xi, i) => (xi - xBar) * (p.y[i] - yBar)));
  const slope = sxy / sxx;
  const intercept = yBar - slope * xBar;
  const sse = sum(p.x.map((xi, i) => (p.y[i] - (slope * xi + intercept)) ** 2));
  const sst = sum(p.y.map((yi) => (yi - yBar) ** 2));

  let slopeStdError = NaN;
  let interceptStdError = NaN;
  if (n > 2) {
    const s2 = sse / (n - 2);
    slopeStdError = Math.sqrt(s2 / sxx);
    interceptStdError = Math.sqrt(s2 * (1 / n + (xBar * xBar) / sxx));
  }

  return {
    ok: true,
    value: {
      slope,
      intercept,
      slopeStdError,
      interceptStdError,
      rSquared: sst === 0 ? NaN : 1 - sse / sst,
      sse,
      n,
    },
  };
}

// ---------------------------------------------------------------------------
// Polynomial regression
// ---------------------------------------------------------------------------

export interface PolynomialFit {
  /** Coefficients in ascending order: c₀ + c₁x + c₂x² + … */
  coefficients: number[];
  stdErrors: number[];
  rSquared: number;
  sse: number;
  n: number;
}

/**
 * Least-squares polynomial of the given degree.
 *
 * Raw powers of x can be badly scaled (think x = 1990…2020, so x² ≈ 4·10⁶),
 * which makes the design matrix nearly singular. We therefore fit in the
 * centred, scaled variable z = (x − μ)/σ with σ = max|xᵢ − μ| so z ∈ [−1, 1],
 * solve with Householder QR, and convert back to powers of x exactly:
 *
 *   Σₖ cₖ·zᵏ = Σₖ cₖ·σ⁻ᵏ·Σⱼ C(k, j)·xʲ·(−μ)ᵏ⁻ʲ
 *   ⇒ aⱼ = Σₖ≥ⱼ cₖ·σ⁻ᵏ·C(k, j)·(−μ)ᵏ⁻ʲ,  i.e.  a = T·c
 *
 * The coefficient covariance transforms the same way: Cov(a) = T·Cov(c)·Tᵀ,
 * with Cov(c) = s²·(ZᵀZ)⁻¹ and s² = SSE/(n − p).
 */
export function polynomialRegression(
  x: readonly number[],
  y: readonly number[],
  degree: number,
): Result<PolynomialFit> {
  if (!Number.isInteger(degree) || degree < 1) {
    return { ok: false, error: "Polynomial degree must be a positive integer." };
  }
  if (x.length !== y.length) return { ok: false, error: "x and y must have the same length." };
  const p = finitePairs(x, y);
  const n = p.x.length;
  const nParams = degree + 1;
  if (n < nParams) {
    return {
      ok: false,
      error: `A degree-${degree} polynomial needs at least ${nParams} data points (found ${n}).`,
    };
  }
  const distinct = countDistinct(p.x);
  if (distinct < nParams) {
    return {
      ok: false,
      error:
        distinct === 1
          ? "All x values are identical, so a polynomial cannot be fitted."
          : `A degree-${degree} polynomial needs at least ${nParams} distinct x values (found ${distinct}).`,
    };
  }

  const mu = sum(p.x) / n;
  let sigma = 0;
  for (const xi of p.x) sigma = Math.max(sigma, Math.abs(xi - mu));
  const z = p.x.map((xi) => (xi - mu) / sigma);
  const Z = z.map((zi) => {
    const row = new Array<number>(nParams);
    let power = 1;
    for (let k = 0; k < nParams; k++) {
      row[k] = power;
      power *= zi;
    }
    return row;
  });

  const solution = solveLeastSquares(Z, p.y);
  if (!solution) {
    return { ok: false, error: "The fit is numerically singular for this data; try a simpler model." };
  }
  const c = solution.coefficients;

  // Residuals evaluated in the well-conditioned z basis.
  const residuals = p.y.map((yi, i) => yi - evaluatePolynomial(c, z[i]));
  const sse = sum(residuals.map((r) => r * r));
  const yBar = sum(p.y) / n;
  const sst = sum(p.y.map((yi) => (yi - yBar) ** 2));

  // Transformation matrix T (a = T·c) from the z basis to the x basis.
  const T: number[][] = Array.from({ length: nParams }, () => new Array<number>(nParams).fill(0));
  for (let j = 0; j < nParams; j++) {
    for (let k = j; k < nParams; k++) {
      T[j][k] = binomial(k, j) * Math.pow(-mu, k - j) / Math.pow(sigma, k);
    }
  }
  const coefficients = T.map((row) => row.reduce((acc, tjk, k) => acc + tjk * c[k], 0));

  let stdErrors = new Array<number>(nParams).fill(NaN);
  if (n > nParams) {
    const s2 = sse / (n - nParams);
    const covC = solution.unscaledCovariance.map((row) => row.map((v) => v * s2));
    const covA = matMul(matMul(T, covC), transpose(T));
    stdErrors = covA.map((row, i) => Math.sqrt(Math.max(0, row[i])));
  }

  return {
    ok: true,
    value: {
      coefficients,
      stdErrors,
      rSquared: sst === 0 ? NaN : 1 - sse / sst,
      sse,
      n,
    },
  };
}

// ---------------------------------------------------------------------------
// Exponential and power-law regression (log-linearised)
// ---------------------------------------------------------------------------

export interface TwoParameterFit {
  A: number;
  B: number;
  AStdError: number;
  BStdError: number;
  /** R² computed in the original y space. */
  rSquared: number;
  /** R² of the straight-line fit in log space. */
  rSquaredLinearized: number;
  sse: number;
  n: number;
}

/**
 * Exponential model y = A·e^(B·x).
 *
 * Taking logarithms gives ln y = ln A + B·x, a straight line, which is
 * fitted by ordinary least squares. This is the same method spreadsheet
 * trendlines use. Note that it minimises squared errors in ln y, which
 * weights small y values more heavily than a direct nonlinear fit would.
 *
 * Uncertainty of A uses first-order error propagation: SE(A) ≈ A·SE(ln A).
 * Requires every y > 0.
 */
export function exponentialRegression(x: readonly number[], y: readonly number[]): Result<TwoParameterFit> {
  if (x.length !== y.length) return { ok: false, error: "x and y must have the same length." };
  const p = finitePairs(x, y);
  const nonPositive = p.y.filter((v) => v <= 0).length;
  if (nonPositive > 0) {
    return {
      ok: false,
      error: `An exponential fit requires every y value to be positive (${nonPositive} of ${p.y.length} are zero or negative).`,
    };
  }
  const lin = linearRegression(p.x, p.y.map(Math.log));
  if (!lin.ok) return lin;
  const A = Math.exp(lin.value.intercept);
  const B = lin.value.slope;
  if (!Number.isFinite(A) || !Number.isFinite(B)) {
    return { ok: false, error: "The exponential fit overflowed; the data may not be exponential." };
  }
  const predicted = p.x.map((xi) => A * Math.exp(B * xi));
  return {
    ok: true,
    value: {
      A,
      B,
      AStdError: A * lin.value.interceptStdError,
      BStdError: lin.value.slopeStdError,
      rSquared: rSquared(p.y, predicted),
      rSquaredLinearized: lin.value.rSquared,
      sse: sum(p.y.map((yi, i) => (yi - predicted[i]) ** 2)),
      n: p.x.length,
    },
  };
}

/**
 * Power-law model y = A·x^B.
 *
 * Linearised as ln y = ln A + B·ln x and fitted by ordinary least squares on
 * (ln x, ln y). Requires every x > 0 and every y > 0.
 */
export function powerRegression(x: readonly number[], y: readonly number[]): Result<TwoParameterFit> {
  if (x.length !== y.length) return { ok: false, error: "x and y must have the same length." };
  const p = finitePairs(x, y);
  const badX = p.x.filter((v) => v <= 0).length;
  if (badX > 0) {
    return {
      ok: false,
      error: `A power-law fit requires every x value to be positive (${badX} of ${p.x.length} are zero or negative).`,
    };
  }
  const badY = p.y.filter((v) => v <= 0).length;
  if (badY > 0) {
    return {
      ok: false,
      error: `A power-law fit requires every y value to be positive (${badY} of ${p.y.length} are zero or negative).`,
    };
  }
  const lin = linearRegression(p.x.map(Math.log), p.y.map(Math.log));
  if (!lin.ok) return lin;
  const A = Math.exp(lin.value.intercept);
  const B = lin.value.slope;
  if (!Number.isFinite(A) || !Number.isFinite(B)) {
    return { ok: false, error: "The power-law fit overflowed; the data may not follow a power law." };
  }
  const predicted = p.x.map((xi) => A * Math.pow(xi, B));
  return {
    ok: true,
    value: {
      A,
      B,
      AStdError: A * lin.value.interceptStdError,
      BStdError: lin.value.slopeStdError,
      rSquared: rSquared(p.y, predicted),
      rSquaredLinearized: lin.value.rSquared,
      sse: sum(p.y.map((yi, i) => (yi - predicted[i]) ** 2)),
      n: p.x.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Model evaluation and the high-level fit entry point
// ---------------------------------------------------------------------------

/** Evaluate a fitted model at x. `params` are in MODEL_INFO display order. */
export function predict(model: RegressionModel, params: readonly number[], x: number): number {
  switch (model) {
    case "linear":
      return params[0] * x + params[1];
    case "quadratic":
      return (params[0] * x + params[1]) * x + params[2];
    case "exponential":
      return params[0] * Math.exp(params[1] * x);
    case "power":
      return x > 0 ? params[0] * Math.pow(x, params[1]) : NaN;
  }
}

/** Evenly spaced samples of a fitted model over [xMin, xMax], for drawing the curve. */
export function sampleModel(
  model: RegressionModel,
  params: readonly number[],
  xMin: number,
  xMax: number,
  count = 200,
): { x: number[]; y: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  if (!Number.isFinite(xMin) || !Number.isFinite(xMax)) return { x: xs, y: ys };
  // A straight line only needs its endpoints.
  const samples = model === "linear" || xMax === xMin ? 2 : Math.max(2, count);
  for (let i = 0; i < samples; i++) {
    const xi = xMin + ((xMax - xMin) * i) / (samples - 1);
    const yi = predict(model, params, xi);
    if (Number.isFinite(yi)) {
      xs.push(xi);
      ys.push(yi);
    }
  }
  return { x: xs, y: ys };
}

function makeParams(model: RegressionModel, values: number[], errors: number[]): FitParameter[] {
  return MODEL_INFO[model].params.map((p, i) => ({
    symbol: p.symbol,
    name: p.name,
    value: values[i],
    stdError: errors[i],
  }));
}

function inRange(v: number, range?: AxisRange): boolean {
  if (!range) return true;
  if (range.min !== null && Number.isFinite(range.min) && v < range.min) return false;
  if (range.max !== null && Number.isFinite(range.max) && v > range.max) return false;
  return true;
}

/**
 * Fit `model` to the columns x and y (full dataset columns, NaN = missing).
 * Rows with a missing x or y are skipped; an optional x-range restricts the
 * fit to part of the data.
 */
export function fitModel(
  model: RegressionModel,
  x: readonly number[],
  y: readonly number[],
  range?: AxisRange,
): FitOutcome {
  const finite = finitePairs(x, y);
  const notes: string[] = [];
  const skipped = Math.min(x.length, y.length) - finite.x.length;
  if (skipped > 0) {
    notes.push(`${skipped} row${skipped === 1 ? "" : "s"} with missing values ${skipped === 1 ? "was" : "were"} skipped.`);
  }

  const used = { x: [] as number[], y: [] as number[], indices: [] as number[] };
  finite.x.forEach((xi, i) => {
    if (inRange(xi, range)) {
      used.x.push(xi);
      used.y.push(finite.y[i]);
      used.indices.push(finite.indices[i]);
    }
  });
  const restricted = used.x.length !== finite.x.length;
  if (restricted) {
    notes.push(`Fit restricted to the selected x range (${used.x.length} of ${finite.x.length} points).`);
  }
  if (used.x.length === 0) {
    return {
      ok: false,
      error: restricted ? "No data points fall inside the selected fit range." : "There are no complete (x, y) data points to fit.",
    };
  }

  let values: number[];
  let errors: number[];
  let rSq: number;
  let rSqLin: number | undefined;
  let method: string;

  switch (model) {
    case "linear": {
      const r = linearRegression(used.x, used.y);
      if (!r.ok) return r;
      values = [r.value.slope, r.value.intercept];
      errors = [r.value.slopeStdError, r.value.interceptStdError];
      rSq = r.value.rSquared;
      method = "Ordinary least squares (closed form).";
      break;
    }
    case "quadratic": {
      const r = polynomialRegression(used.x, used.y, 2);
      if (!r.ok) return r;
      const [c0, c1, c2] = r.value.coefficients;
      const [e0, e1, e2] = r.value.stdErrors;
      values = [c2, c1, c0];
      errors = [e2, e1, e0];
      rSq = r.value.rSquared;
      method = "Polynomial least squares (Householder QR on centred, scaled x).";
      break;
    }
    case "exponential": {
      const r = exponentialRegression(used.x, used.y);
      if (!r.ok) return r;
      values = [r.value.A, r.value.B];
      errors = [r.value.AStdError, r.value.BStdError];
      rSq = r.value.rSquared;
      rSqLin = r.value.rSquaredLinearized;
      method = "Linear least squares on ln(y) vs x (log-linearised).";
      break;
    }
    case "power": {
      const r = powerRegression(used.x, used.y);
      if (!r.ok) return r;
      values = [r.value.A, r.value.B];
      errors = [r.value.AStdError, r.value.BStdError];
      rSq = r.value.rSquared;
      rSqLin = r.value.rSquaredLinearized;
      method = "Linear least squares on ln(y) vs ln(x) (log-linearised).";
      break;
    }
  }

  const residuals = used.x.map((xi, i) => used.y[i] - predict(model, values, xi));
  const sse = sum(residuals.map((r) => r * r));
  const nParams = values.length;
  const n = used.x.length;

  const result: FitResult = {
    model,
    params: makeParams(model, values, errors),
    rSquared: rSq,
    rSquaredLinearized: rSqLin,
    n,
    sse,
    rmse: n > nParams ? Math.sqrt(sse / (n - nParams)) : NaN,
    x: used.x,
    y: used.y,
    rowIndices: used.indices,
    residuals,
    method,
    notes,
  };
  return { ok: true, result };
}
