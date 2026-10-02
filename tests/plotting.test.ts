import { describe, expect, it } from "vitest";
import type { DataColumn } from "@/types/dataset";
import { axisRangeProps, buildMainFigure, buildResidualFigure } from "@/lib/plotting";
import { fitModel } from "@/lib/regression";

function col(name: string, values: number[], unit = ""): DataColumn {
  return { id: name, name, symbol: name, unit, kind: "numeric", values, origin: { type: "imported" }, uncertainty: null };
}

const t = col("time", [0, 1, 2, NaN, 4], "s");
const x = col("position", [0, 1, 4, 9, NaN], "m");

describe("axisRangeProps", () => {
  it("handles automatic, full and one-sided ranges", () => {
    expect(axisRangeProps({ min: null, max: null })).toEqual({ autorange: true });
    expect(axisRangeProps({ min: 0, max: 10 })).toEqual({ range: [0, 10], autorange: false });
    expect(axisRangeProps({ min: 0, max: null })).toEqual({ range: [0, null], autorange: "max" });
    expect(axisRangeProps({ min: null, max: 5 })).toEqual({ range: [null, 5], autorange: "min" });
    expect(axisRangeProps({ min: 5, max: 1 })).toEqual({ autorange: true });
  });
});

describe("buildMainFigure", () => {
  const base = {
    x: t,
    errorX: null,
    plotMode: "markers" as const,
    title: "Position vs time",
    xTitle: "time (s)",
    yTitle: "position (m)",
    xRange: { min: null, max: null },
    yRange: { min: null, max: null },
    fit: null,
    revision: "r",
  };

  it("plots only rows where both values are present", () => {
    const fig = buildMainFigure({ ...base, series: [{ column: x, color: "#000", errorY: null }] });
    const trace = fig.data[0] as { x: number[]; y: number[] };
    expect(trace.x).toEqual([0, 1, 2]);
    expect(trace.y).toEqual([0, 1, 4]);
    expect(fig.layout.showlegend).toBe(false);
  });

  it("adds error bars and a fit curve", () => {
    const fit = fitModel("quadratic", t.values, x.values);
    if (!fit.ok) throw new Error(fit.error);
    const fig = buildMainFigure({
      ...base,
      series: [{ column: x, color: "#000", errorY: [0.1, 0.1, 0.1, 0.1, 0.1] }],
      fit: { model: "quadratic", params: fit.result.params.map((p) => p.value), xMin: 0, xMax: 2, range: null },
    });
    const data = fig.data[0] as { error_y: { array: number[] } };
    expect(data.error_y.array).toEqual([0.1, 0.1, 0.1]);
    const curve = fig.data[1] as { x: number[]; y: number[]; name: string };
    expect(curve.name).toBe("Quadratic fit");
    expect(curve.y[curve.y.length - 1]).toBeCloseTo(4, 8);
    expect(fig.layout.showlegend).toBe(true);
  });
});

describe("buildResidualFigure", () => {
  it("plots residuals with a zero reference line", () => {
    const fit = fitModel("linear", [0, 1, 2], [0, 2, 1]);
    if (!fit.ok) throw new Error(fit.error);
    const fig = buildResidualFigure({ fit: fit.result, color: "#000", xTitle: "x", yUnit: "m", errorY: null, revision: "r" });
    expect((fig.data[0] as { y: number[] }).y).toEqual(fit.result.residuals);
    expect(fig.layout.shapes?.[0]).toMatchObject({ type: "line", y0: 0, y1: 0 });
  });
});
