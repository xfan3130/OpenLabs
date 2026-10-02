import { describe, expect, it } from "vitest";
import { derivativeOfSorted, numericalDerivative } from "@/lib/derivative";

describe("derivativeOfSorted", () => {
  it("is exact for a quadratic on a uniform grid, including the endpoints", () => {
    // x(t) = ½·9.8·t² ⇒ v(t) = 9.8·t
    const t = Array.from({ length: 11 }, (_, i) => i * 0.1);
    const x = t.map((ti) => 0.5 * 9.8 * ti * ti);
    const v = derivativeOfSorted(t, x);
    v.forEach((vi, i) => expect(vi).toBeCloseTo(9.8 * t[i], 10));
  });

  it("is exact for a quadratic on a non-uniform grid", () => {
    const t = [0, 0.1, 0.25, 0.3, 0.55, 0.7, 1.0];
    const y = t.map((ti) => 3 * ti * ti - 2 * ti + 1);
    const d = derivativeOfSorted(t, y);
    d.forEach((di, i) => expect(di).toBeCloseTo(6 * t[i] - 2, 10));
  });

  it("reduces to (y[i+1] − y[i−1]) / 2h in the interior for uniform spacing", () => {
    const x = [0, 1, 2, 3, 4];
    const y = [0, 1, 8, 27, 64];
    const d = derivativeOfSorted(x, y);
    expect(d[1]).toBeCloseTo((8 - 0) / 2, 12);
    expect(d[2]).toBeCloseTo((27 - 1) / 2, 12);
    expect(d[3]).toBeCloseTo((64 - 8) / 2, 12);
    // One-sided: (−3y₀ + 4y₁ − y₂) / 2h and (3y₄ − 4y₃ + y₂) / 2h
    expect(d[0]).toBeCloseTo((-3 * 0 + 4 * 1 - 8) / 2, 12);
    expect(d[4]).toBeCloseTo((3 * 64 - 4 * 27 + 8) / 2, 12);
  });

  it("converges at second order for a smooth non-polynomial function", () => {
    const err = (h: number) => {
      const x = Array.from({ length: Math.round(1 / h) + 1 }, (_, i) => i * h);
      const d = derivativeOfSorted(x, x.map(Math.sin));
      return Math.max(...d.map((di, i) => Math.abs(di - Math.cos(x[i]))));
    };
    const ratio = err(0.02) / err(0.01);
    expect(ratio).toBeGreaterThan(3.5); // ≈ 4 for second order
  });

  it("uses a simple difference for two points", () => {
    expect(derivativeOfSorted([1, 3], [2, 6])).toEqual([2, 2]);
  });

  it("is a constant for linear data", () => {
    const x = [0, 0.3, 0.4, 1.1];
    const d = derivativeOfSorted(x, x.map((v) => -2.5 * v + 7));
    d.forEach((di) => expect(di).toBeCloseTo(-2.5, 12));
  });

  it("throws on invalid input", () => {
    expect(() => derivativeOfSorted([1], [1])).toThrow();
    expect(() => derivativeOfSorted([1, 2], [1])).toThrow();
  });
});

describe("numericalDerivative", () => {
  it("leaves rows with missing values blank (NaN)", () => {
    const out = numericalDerivative([0, 1, NaN, 2, 3], [0, 1, 5, 4, 9]);
    if (!out.ok) throw new Error(out.error);
    expect(out.values[2]).toBeNaN();
    expect(out.values[1]).toBeCloseTo(2, 12); // central over x = 0, 1, 2
    expect(out.warnings.join(" ")).toMatch(/1 row/);
  });

  it("sorts unsorted rows but returns values in the original row order", () => {
    const t = [0.2, 0, 0.1, 0.3];
    const out = numericalDerivative(t, t.map((v) => v * v));
    if (!out.ok) throw new Error(out.error);
    out.values.forEach((d, i) => expect(d).toBeCloseTo(2 * t[i], 10));
    expect(out.warnings.join(" ")).toMatch(/sorting/);
  });

  it("rejects duplicate x values instead of dividing by zero", () => {
    const out = numericalDerivative([0, 1, 1, 2], [0, 1, 2, 3]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toMatch(/more than once/);
  });

  it("needs at least two complete rows", () => {
    expect(numericalDerivative([], []).ok).toBe(false);
    expect(numericalDerivative([1], [1]).ok).toBe(false);
    expect(numericalDerivative([1, NaN], [1, 2]).ok).toBe(false);
  });

  it("rejects columns of different length", () => {
    expect(numericalDerivative([1, 2, 3], [1, 2]).ok).toBe(false);
  });
});
