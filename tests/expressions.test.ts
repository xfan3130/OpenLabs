import { describe, expect, it } from "vitest";
import { checkExpression, evaluateExpression } from "@/lib/expressions";
import type { DataColumn } from "@/types/dataset";

function column(symbol: string, values: number[]): DataColumn {
  return {
    id: symbol,
    name: symbol,
    symbol,
    unit: "",
    kind: "numeric",
    values,
    origin: { type: "imported" },
    uncertainty: null,
  };
}

const columns = [
  column("time", [0, 1, 2, 3]),
  column("position1", [0, 2, 4, 6]),
  column("position2", [1, 4, 9, NaN]),
];

describe("checkExpression", () => {
  it("accepts arithmetic on column names", () => {
    const r = checkExpression("(position2 - position1) / time", ["time", "position1", "position2"]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.symbols.sort()).toEqual(["position1", "position2", "time"]);
  });

  it("accepts allowed functions and constants", () => {
    expect(checkExpression("sqrt(time) + sin(pi * time) + ln(e)", ["time"]).ok).toBe(true);
    expect(checkExpression("0.5 * 9.8 * time^2", ["time"]).ok).toBe(true);
  });

  it("reports syntax errors", () => {
    const r = checkExpression("(time + ", ["time"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Syntax error/);
  });

  it("reports unknown variables with suggestions", () => {
    const r = checkExpression("Time * 2", ["time"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Did you mean "time"/);
    const r2 = checkExpression("velocity * 2", ["time"]);
    if (!r2.ok) expect(r2.error).toMatch(/Available columns: time/);
  });

  it("rejects functions outside the allow-list", () => {
    for (const expr of ["import({}, {})", "evaluate(\"1+1\")", "createUnit(\"foo\")", "parse(\"x\")"]) {
      expect(checkExpression(expr, ["time"]).ok).toBe(false);
    }
  });

  it("rejects assignments, strings, units, matrices and blocks", () => {
    expect(checkExpression("x = time", ["time"]).ok).toBe(false);
    expect(checkExpression("f(x) = x", ["time"]).ok).toBe(false);
    expect(checkExpression("\"abc\"", ["time"]).ok).toBe(false);
    expect(checkExpression("time * cm", ["time"]).ok).toBe(false);
    expect(checkExpression("5 cm to m", ["time"]).ok).toBe(false);
    expect(checkExpression("[1, 2]", ["time"]).ok).toBe(false);
    expect(checkExpression("time; time", ["time"]).ok).toBe(false);
    expect(checkExpression("time > 1", ["time"]).ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(checkExpression("   ", ["time"]).ok).toBe(false);
  });
});

describe("evaluateExpression", () => {
  it("evaluates row by row", () => {
    const r = evaluateExpression("position1 * 2 + time", columns, 4);
    if (!r.ok) throw new Error(r.error);
    expect(r.values).toEqual([0, 5, 10, 15]);
    expect(r.invalidCount).toBe(0);
  });

  it("propagates missing values without counting them as invalid", () => {
    const r = evaluateExpression("position2 - position1", columns, 4);
    if (!r.ok) throw new Error(r.error);
    expect(r.values.slice(0, 3)).toEqual([1, 2, 5]);
    expect(r.values[3]).toBeNaN();
    expect(r.invalidCount).toBe(0);
  });

  it("marks division by zero and invalid logs as missing and counts them", () => {
    const r = evaluateExpression("position1 / time", columns, 4);
    if (!r.ok) throw new Error(r.error);
    expect(r.values[0]).toBeNaN();
    expect(r.values.slice(1)).toEqual([2, 2, 2]);
    expect(r.invalidCount).toBe(1);

    const r2 = evaluateExpression("sqrt(time - 2)", columns, 4);
    if (!r2.ok) throw new Error(r2.error);
    expect(r2.values[0]).toBeNaN(); // sqrt(−2) is not real
    expect(r2.values[3]).toBe(1);
    expect(r2.invalidCount).toBe(2);
  });

  it("supports ln, deg and rad helpers", () => {
    const r = evaluateExpression("ln(exp(time)) + deg(rad(30))", columns, 4);
    if (!r.ok) throw new Error(r.error);
    r.values.forEach((v, i) => expect(v).toBeCloseTo(i + 30, 12));
  });

  it("reports wrong argument counts before evaluating data", () => {
    const r = evaluateExpression("atan2(time)", columns, 4);
    expect(r.ok).toBe(false);
  });
});
