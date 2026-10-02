import type { RegressionModel } from "./dataset";

/** Descriptive statistics for one column. Undefined quantities are NaN. */
export interface DescriptiveStats {
  /** Number of finite values actually used. */
  n: number;
  /** Number of entries that were missing / non-finite and therefore ignored. */
  missing: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  range: number;
  /** Sample standard deviation (n − 1 denominator). NaN when n < 2. */
  stdDev: number;
  /** Standard error of the mean, s / √n. NaN when n < 2. */
  stdError: number;
}

export interface FitParameter {
  /** Symbol used in the model equation, e.g. "m", "A". */
  symbol: string;
  /** Human-readable name, e.g. "slope". */
  name: string;
  value: number;
  /** One-standard-error uncertainty from the least-squares covariance. NaN when undefined. */
  stdError: number;
}

export interface FitResult {
  model: RegressionModel;
  /** Ordered as the model's parameter list (see MODEL_INFO in lib/regression). */
  params: FitParameter[];
  /** Coefficient of determination computed in the original y space. */
  rSquared: number;
  /** For log-linearised models: R² of the straight-line fit in log space. */
  rSquaredLinearized?: number;
  /** Number of points used in the fit. */
  n: number;
  /** Residual sum of squares Σ(yᵢ − ŷᵢ)². */
  sse: number;
  /** Standard error of the regression √(SSE / (n − p)). NaN when n ≤ p. */
  rmse: number;
  /** The x / y values of the points used in the fit, in row order. */
  x: number[];
  y: number[];
  /** Row index (into the dataset) of each point used. */
  rowIndices: number[];
  /** Residuals yᵢ − ŷᵢ, aligned with `x` / `y`. */
  residuals: number[];
  /** Description of the estimation method, for reports. */
  method: string;
  /** Non-fatal notes (points excluded, etc.). */
  notes: string[];
}

export type FitOutcome =
  | { ok: true; result: FitResult }
  | { ok: false; error: string };
