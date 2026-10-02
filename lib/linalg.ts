/**
 * Small dense linear-algebra helpers for least-squares fitting.
 *
 * Matrices are row-major `number[][]`. Sizes in OpenLab are tiny (a few
 * hundred rows × at most a handful of columns), so clarity wins over speed.
 */

export interface LeastSquaresSolution {
  /** Coefficients β minimising ‖Aβ − b‖². */
  coefficients: number[];
  /**
   * (AᵀA)⁻¹. Multiplying by the residual variance s² gives the covariance
   * matrix of the coefficients, whose diagonal holds their squared standard
   * errors.
   */
  unscaledCovariance: number[][];
}

/**
 * Solve the linear least-squares problem min ‖Aβ − b‖² using a Householder
 * QR decomposition.
 *
 * Why QR instead of the normal equations (AᵀA)β = Aᵀb? Forming AᵀA squares
 * the condition number of the problem, so polynomial fits on poorly scaled
 * data can lose most of their significant digits. Householder reflections
 * work on A directly and are backward stable.
 *
 * Algorithm: for each column k, build a reflection H = I − 2vvᵀ/(vᵀv) that
 * zeroes the entries below the diagonal. Applying all reflections gives
 * QᵀA = R (upper triangular) and Qᵀb. Then Rβ = (Qᵀb)[0..n) is solved by
 * back substitution.
 *
 * Returns null if A is rank deficient (columns linearly dependent, e.g. all
 * x values identical) or the system is underdetermined (fewer rows than
 * columns).
 */
export function solveLeastSquares(A: number[][], b: number[]): LeastSquaresSolution | null {
  const m = A.length;
  if (m === 0 || b.length !== m) return null;
  const n = A[0].length;
  if (n === 0 || m < n) return null;

  const R = A.map((row) => row.slice());
  const qtb = b.slice();

  // Scale used to decide whether a diagonal entry of R is "numerically zero".
  let maxColumnNorm = 0;
  for (let j = 0; j < n; j++) {
    let s = 0;
    for (let i = 0; i < m; i++) s += R[i][j] * R[i][j];
    maxColumnNorm = Math.max(maxColumnNorm, Math.sqrt(s));
  }
  if (maxColumnNorm === 0 || !Number.isFinite(maxColumnNorm)) return null;
  const tolerance = maxColumnNorm * Math.max(m, n) * Number.EPSILON * 16;

  for (let k = 0; k < n; k++) {
    // Norm of the sub-column R[k..m)[k].
    let norm = 0;
    for (let i = k; i < m; i++) norm += R[i][k] * R[i][k];
    norm = Math.sqrt(norm);
    if (norm <= tolerance) return null; // rank deficient

    // Choose the sign that avoids cancellation when forming v.
    const alpha = R[k][k] > 0 ? -norm : norm;
    const v = new Array<number>(m - k);
    for (let i = k; i < m; i++) v[i - k] = R[i][k];
    v[0] -= alpha;
    let vNorm2 = 0;
    for (const vi of v) vNorm2 += vi * vi;
    if (vNorm2 === 0) continue;

    // Apply H to the remaining columns of R.
    for (let j = k; j < n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += v[i - k] * R[i][j];
      const f = (2 * dot) / vNorm2;
      for (let i = k; i < m; i++) R[i][j] -= f * v[i - k];
    }
    // ...and to b.
    let dot = 0;
    for (let i = k; i < m; i++) dot += v[i - k] * qtb[i];
    const f = (2 * dot) / vNorm2;
    for (let i = k; i < m; i++) qtb[i] -= f * v[i - k];
  }

  for (let k = 0; k < n; k++) {
    if (Math.abs(R[k][k]) <= tolerance) return null;
  }

  // Back substitution R β = Qᵀb.
  const beta = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = qtb[i];
    for (let j = i + 1; j < n; j++) s -= R[i][j] * beta[j];
    beta[i] = s / R[i][i];
  }

  // (AᵀA)⁻¹ = (RᵀR)⁻¹ = R⁻¹ R⁻ᵀ. Invert the upper-triangular R column by column.
  const Rinv: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let col = 0; col < n; col++) {
    for (let i = n - 1; i >= 0; i--) {
      let s = i === col ? 1 : 0;
      for (let j = i + 1; j < n; j++) s -= R[i][j] * Rinv[j][col];
      Rinv[i][col] = s / R[i][i];
    }
  }
  const cov: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Rinv[i][k] * Rinv[j][k];
      cov[i][j] = s;
    }
  }

  if (!beta.every(Number.isFinite)) return null;
  return { coefficients: beta, unscaledCovariance: cov };
}

/** C = A·B for small dense matrices. */
export function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const inner = B.length;
  const cols = inner === 0 ? 0 : B[0].length;
  const C: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const a = A[i][k];
      for (let j = 0; j < cols; j++) C[i][j] += a * B[k][j];
    }
  }
  return C;
}

export function transpose(A: number[][]): number[][] {
  if (A.length === 0) return [];
  return A[0].map((_, j) => A.map((row) => row[j]));
}

/** Binomial coefficient C(n, k) for small non-negative integers. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let result = 1;
  for (let i = 1; i <= k; i++) result = (result * (n - k + i)) / i;
  return Math.round(result);
}
