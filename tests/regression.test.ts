import { describe, expect, it } from "vitest";
import { inv, multiply, transpose as mjTranspose } from "mathjs";
import {
  evaluatePolynomial,
  exponentialRegression,
  fitModel,
  linearRegression,
  polynomialRegression,
  powerRegression,
  predict,
  rSquared,
  sampleModel,
} from "@/lib/regression";

describe("linearRegression", () => {
  // Hand-computed: x̄ = 3, ȳ = 4, Sxx = 10, Sxy = 6, SSE = 2.4, SST = 6.
  const x = [1, 2, 3, 4, 5];
  const y = [2, 4, 5, 4, 5];

  it("matches a hand-computed example", () => {
    const r = linearRegression(x, y);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.slope).toBeCloseTo(0.6, 12);
    expect(r.value.intercept).toBeCloseTo(2.2, 12);
    expect(r.value.rSquared).toBeCloseTo(0.6, 12);
    expect(r.value.sse).toBeCloseTo(2.4, 12);
    // SE(m) = √(s²/Sxx), SE(b) = √(s²(1/n + x̄²/Sxx)), s² = 2.4/3
    expect(r.value.slopeStdError).toBeCloseTo(Math.sqrt(0.08), 12);
    expect(r.value.interceptStdError).toBeCloseTo(Math.sqrt(0.88), 12);
  });

  it("recovers an exact line with R² = 1 and zero uncertainty", () => {
    const xs = [0, 1, 2, 3, 4];
    const r = linearRegression(xs, xs.map((v) => 4.82 * v + 0.13));
    if (!r.ok) throw new Error(r.error);
    expect(r.value.slope).toBeCloseTo(4.82, 12);
    expect(r.value.intercept).toBeCloseTo(0.13, 12);
    expect(r.value.rSquared).toBeCloseTo(1, 12);
    expect(r.value.slopeStdError).toBeCloseTo(0, 10);
  });

  it("skips rows with NaN in x or y", () => {
    const r = linearRegression([1, 2, NaN, 3, 4], [2, 4, 100, 6, NaN]);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.n).toBe(3);
    expect(r.value.slope).toBeCloseTo(2, 12);
    expect(r.value.intercept).toBeCloseTo(0, 12);
  });

  it("rejects empty and one-point datasets", () => {
    expect(linearRegression([], []).ok).toBe(false);
    expect(linearRegression([1], [2]).ok).toBe(false);
  });

  it("rejects identical x values (vertical line, division by zero)", () => {
    const r = linearRegression([2, 2, 2], [1, 2, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/identical/);
  });

  it("returns NaN standard errors for exactly two points", () => {
    const r = linearRegression([0, 1], [1, 3]);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.slope).toBe(2);
    expect(r.value.slopeStdError).toBeNaN();
  });

  it("gives an undefined R² when every y is identical", () => {
    const r = linearRegression([1, 2, 3], [5, 5, 5]);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.slope).toBe(0);
    expect(r.value.rSquared).toBeNaN();
  });

  it("rejects arrays of different lengths", () => {
    expect(linearRegression([1, 2, 3], [1, 2]).ok).toBe(false);
  });
});

describe("polynomialRegression", () => {
  it("recovers an exact quadratic", () => {
    const x = [0, 1, 2, 3, 4, 5];
    const y = x.map((v) => 2 * v * v - 3 * v + 1);
    const r = polynomialRegression(x, y, 2);
    if (!r.ok) throw new Error(r.error);
    const [c, b, a] = r.value.coefficients;
    expect(a).toBeCloseTo(2, 10);
    expect(b).toBeCloseTo(-3, 10);
    expect(c).toBeCloseTo(1, 10);
    expect(r.value.rSquared).toBeCloseTo(1, 12);
  });

  it("stays accurate for badly scaled x (e.g. calendar years)", () => {
    const x = Array.from({ length: 11 }, (_, i) => 2000 + i);
    const y = x.map((v) => 0.5 * (v - 2005) ** 2 + 3);
    const r = polynomialRegression(x, y, 2);
    if (!r.ok) throw new Error(r.error);
    const [c, b, a] = r.value.coefficients;
    expect(a).toBeCloseTo(0.5, 8);
    expect(b / -2005).toBeCloseTo(1, 8);
    expect(c / (0.5 * 2005 * 2005 + 3)).toBeCloseTo(1, 8);
    // Predictions must reproduce the data.
    x.forEach((xi, i) => expect(evaluatePolynomial(r.value.coefficients, xi)).toBeCloseTo(y[i], 4));
  });

  it("matches linear regression (including standard errors) for degree 1", () => {
    const x = [1, 2, 3, 4, 5];
    const y = [2, 4, 5, 4, 5];
    const poly = polynomialRegression(x, y, 1);
    const lin = linearRegression(x, y);
    if (!poly.ok || !lin.ok) throw new Error("fit failed");
    expect(poly.value.coefficients[1]).toBeCloseTo(lin.value.slope, 12);
    expect(poly.value.coefficients[0]).toBeCloseTo(lin.value.intercept, 12);
    expect(poly.value.stdErrors[1]).toBeCloseTo(lin.value.slopeStdError, 12);
    expect(poly.value.stdErrors[0]).toBeCloseTo(lin.value.interceptStdError, 12);
    expect(poly.value.rSquared).toBeCloseTo(lin.value.rSquared, 12);
  });

  it("matches the normal-equation covariance for a quadratic", () => {
    const x = [0, 0.5, 1, 1.5, 2, 2.5, 3];
    const y = [1.1, 1.9, 3.2, 4.8, 7.1, 9.8, 13.2];
    const r = polynomialRegression(x, y, 2);
    if (!r.ok) throw new Error(r.error);

    // Independent reference via (XᵀX)⁻¹Xᵀy on this well-conditioned data.
    const X = x.map((v) => [1, v, v * v]);
    const Xt = mjTranspose(X) as number[][];
    const XtXinv = inv(multiply(Xt, X) as number[][]) as number[][];
    const beta = multiply(multiply(XtXinv, Xt), y) as unknown as number[];
    const resid = y.map((yi, i) => yi - (beta[0] + beta[1] * x[i] + beta[2] * x[i] ** 2));
    const s2 = resid.reduce((a, v) => a + v * v, 0) / (x.length - 3);
    beta.forEach((b, i) => {
      expect(r.value.coefficients[i]).toBeCloseTo(b, 10);
      expect(r.value.stdErrors[i]).toBeCloseTo(Math.sqrt(s2 * XtXinv[i][i]), 10);
    });
  });

  it("requires enough distinct x values", () => {
    const r = polynomialRegression([1, 1, 2, 2], [1, 2, 3, 4], 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/3 distinct x values/);
  });

  it("rejects identical x values", () => {
    const r = polynomialRegression([3, 3, 3, 3], [1, 2, 3, 4], 2);
    expect(r.ok).toBe(false);
  });

  it("rejects too few points and empty input", () => {
    expect(polynomialRegression([1, 2], [1, 4], 2).ok).toBe(false);
    expect(polynomialRegression([], [], 2).ok).toBe(false);
  });

  it("interpolates exactly when n = degree + 1 (standard errors undefined)", () => {
    const r = polynomialRegression([0, 1, 2], [1, 2, 5], 2);
    if (!r.ok) throw new Error(r.error);
    expect(r.value.coefficients[2]).toBeCloseTo(1, 12);
    expect(r.value.stdErrors.every(Number.isNaN)).toBe(true);
  });
});

describe("rSquared", () => {
  it("is 1 for a perfect prediction", () => {
    expect(rSquared([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it("is 0 when predicting the mean", () => {
    expect(rSquared([1, 2, 3], [2, 2, 2])).toBe(0);
  });

  it("can be negative for a model worse than the mean", () => {
    expect(rSquared([1, 2, 3], [3, 2, 1])).toBeCloseTo(-3, 12);
  });

  it("is NaN for constant observations, empty input, or mismatched lengths", () => {
    expect(rSquared([5, 5, 5], [5, 5, 5])).toBeNaN();
    expect(rSquared([], [])).toBeNaN();
    expect(rSquared([1, 2], [1])).toBeNaN();
  });

  it("ignores pairs containing NaN", () => {
    expect(rSquared([1, 2, NaN, 3], [1, 2, 7, 3])).toBe(1);
  });
});

describe("exponentialRegression", () => {
  it("recovers y = 3·e^(0.5x)", () => {
    const x = [0, 1, 2, 3, 4, 5];
    const r = exponentialRegression(x, x.map((v) => 3 * Math.exp(0.5 * v)));
    if (!r.ok) throw new Error(r.error);
    expect(r.value.A).toBeCloseTo(3, 10);
    expect(r.value.B).toBeCloseTo(0.5, 10);
    expect(r.value.rSquared).toBeCloseTo(1, 10);
    expect(r.value.rSquaredLinearized).toBeCloseTo(1, 10);
  });

  it("recovers a decaying exponential", () => {
    const x = [0, 0.5, 1, 1.5, 2];
    const r = exponentialRegression(x, x.map((v) => 12 * Math.exp(-1.3 * v)));
    if (!r.ok) throw new Error(r.error);
    expect(r.value.A).toBeCloseTo(12, 10);
    expect(r.value.B).toBeCloseTo(-1.3, 10);
  });

  it("rejects zero or negative y values", () => {
    const r = exponentialRegression([0, 1, 2], [1, 0, 3]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/positive/);
  });
});

describe("powerRegression", () => {
  it("recovers y = 2·x^1.5", () => {
    const x = [0.5, 1, 2, 3, 4];
    const r = powerRegression(x, x.map((v) => 2 * Math.pow(v, 1.5)));
    if (!r.ok) throw new Error(r.error);
    expect(r.value.A).toBeCloseTo(2, 10);
    expect(r.value.B).toBeCloseTo(1.5, 10);
  });

  it("rejects x ≤ 0 and y ≤ 0", () => {
    expect(powerRegression([0, 1, 2], [1, 2, 3]).ok).toBe(false);
    expect(powerRegression([1, 2, 3], [1, -2, 3]).ok).toBe(false);
  });

  it("rejects identical x values", () => {
    expect(powerRegression([2, 2, 2], [1, 2, 3]).ok).toBe(false);
  });
});

describe("fitModel", () => {
  const x = [0, 1, 2, 3, 4, 5, NaN];
  const y = [1, 3, 5, 7, 9, 30, 4];

  it("skips missing rows and reports it", () => {
    const out = fitModel("linear", [0, 1, 2, NaN], [1, 3, 5, 9]);
    if (!out.ok) throw new Error(out.error);
    expect(out.result.n).toBe(3);
    expect(out.result.rowIndices).toEqual([0, 1, 2]);
    expect(out.result.notes.join(" ")).toMatch(/1 row/);
  });

  it("restricts the fit to an x range", () => {
    const out = fitModel("linear", x, y, { min: 0, max: 4 });
    if (!out.ok) throw new Error(out.error);
    expect(out.result.n).toBe(5);
    expect(out.result.params[0].value).toBeCloseTo(2, 12);
    expect(out.result.params[1].value).toBeCloseTo(1, 12);
    expect(out.result.residuals.every((r) => Math.abs(r) < 1e-12)).toBe(true);
  });

  it("errors when the range excludes every point", () => {
    const out = fitModel("linear", x, y, { min: 100, max: null });
    expect(out.ok).toBe(false);
  });

  it("orders quadratic parameters as a, b, c", () => {
    const xs = [0, 1, 2, 3, 4];
    const out = fitModel("quadratic", xs, xs.map((v) => 4.9 * v * v + 0.2 * v + 0.01));
    if (!out.ok) throw new Error(out.error);
    const [a, b, c] = out.result.params.map((p) => p.value);
    expect(a).toBeCloseTo(4.9, 10);
    expect(b).toBeCloseTo(0.2, 10);
    expect(c).toBeCloseTo(0.01, 10);
    expect(out.result.params.map((p) => p.symbol)).toEqual(["a", "b", "c"]);
  });

  it("computes residuals as y − ŷ and the RMSE with n − p degrees of freedom", () => {
    const out = fitModel("linear", [1, 2, 3, 4, 5], [2, 4, 5, 4, 5]);
    if (!out.ok) throw new Error(out.error);
    const expected = [-0.8, 0.6, 1.0, -0.6, -0.2];
    out.result.residuals.forEach((r, i) => expect(r).toBeCloseTo(expected[i], 12));
    expect(out.result.rmse).toBeCloseTo(Math.sqrt(2.4 / 3), 12);
  });

  it("propagates model errors", () => {
    const out = fitModel("exponential", [0, 1, 2], [-1, -2, -3]);
    expect(out.ok).toBe(false);
  });
});

describe("predict / sampleModel", () => {
  it("evaluates each model", () => {
    expect(predict("linear", [2, 1], 3)).toBe(7);
    expect(predict("quadratic", [1, 2, 3], 2)).toBe(11);
    expect(predict("exponential", [2, 0], 5)).toBe(2);
    expect(predict("power", [3, 2], 2)).toBe(12);
    expect(predict("power", [3, 0.5], -1)).toBeNaN();
  });

  it("samples a curve over the requested interval", () => {
    const s = sampleModel("quadratic", [1, 0, 0], -1, 1, 5);
    expect(s.x).toEqual([-1, -0.5, 0, 0.5, 1]);
    expect(s.y).toEqual([1, 0.25, 0, 0.25, 1]);
    expect(sampleModel("linear", [1, 0], 0, 10).x).toEqual([0, 10]);
  });
});
