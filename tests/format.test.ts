import { describe, expect, it } from "vitest";
import { formatMeasured, formatNumber, formatPercent, formatPlain, formatWithUncertainty } from "@/lib/format";
import { formatEquation, formatRSquared, parameterUnits } from "@/lib/report";
import { parseHeaderUnit, quotientUnit } from "@/lib/units";
import { absoluteUncertainties, chiSquare, percentUncertainty } from "@/lib/uncertainty";

describe("formatNumber", () => {
  it("rounds to significant figures", () => {
    expect(formatNumber(9.80665)).toBe("9.807");
    expect(formatNumber(0.012345)).toBe("0.01235");
    expect(formatNumber(1234.5678)).toBe("1235");
    expect(formatNumber(4.9, 4)).toBe("4.900");
  });

  it("uses scientific notation for very small and very large values", () => {
    expect(formatNumber(0.000012346)).toBe("1.235 × 10⁻⁵");
    expect(formatNumber(6.02214e23)).toBe("6.022 × 10²³");
    expect(formatNumber(-0.00042)).toBe("−4.200 × 10⁻⁴");
  });

  it("handles rounding that changes the order of magnitude", () => {
    expect(formatNumber(9.99996)).toBe("10.00");
  });

  it("formats special values", () => {
    expect(formatNumber(NaN)).toBe("—");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(Infinity)).toBe("∞");
    expect(formatNumber(-2.5)).toBe("−2.500");
  });
});

describe("formatMeasured", () => {
  it("shows recorded values without padding zeros", () => {
    expect(formatMeasured(-0.003)).toBe("−0.003");
    expect(formatMeasured(1.2)).toBe("1.2");
    expect(formatMeasured(7.052)).toBe("7.052");
    expect(formatMeasured(120)).toBe("120");
    expect(formatMeasured(0)).toBe("0");
    expect(formatMeasured(0.00002)).toBe("2 × 10⁻⁵");
    expect(formatMeasured(1.23456789)).toBe("1.23457");
    expect(formatMeasured(NaN)).toBe("—");
  });
});

describe("formatWithUncertainty", () => {
  it("rounds the uncertainty to 1 significant figure and the value to match", () => {
    expect(formatWithUncertainty(4.8213, 0.0532)).toBe("4.82 ± 0.05");
  });

  it("keeps 2 significant figures when the uncertainty starts with 1 or 2", () => {
    expect(formatWithUncertainty(9.8123, 0.0147)).toBe("9.812 ± 0.015");
  });

  it("uses a shared power of ten for small values", () => {
    expect(formatWithUncertainty(1.234e-7, 3.1e-9)).toBe("(1.23 ± 0.03) × 10⁻⁷");
  });

  it("handles uncertainties larger than 1", () => {
    expect(formatWithUncertainty(12345, 320)).toBe("12300 ± 300");
  });

  it("does not produce absurd digit strings for floating-point-noise uncertainties", () => {
    expect(formatWithUncertainty(4.8999999999999995, 8.6e-16)).toBe("4.900 ± 8.6 × 10⁻¹⁶");
    expect(formatWithUncertainty(4.9, 3e-9)).toBe("4.900000000 ± 0.000000003");
  });

  it("falls back when the uncertainty is undefined", () => {
    expect(formatWithUncertainty(2.5, NaN)).toBe("2.500");
    expect(formatWithUncertainty(2.5, 0)).toBe("2.500");
  });
});

describe("formatPercent / formatPlain", () => {
  it("formats percentages", () => {
    expect(formatPercent(1.234)).toBe("1.2 %");
    expect(formatPercent(12.34)).toBe("12.3 %");
    expect(formatPercent(NaN)).toBe("—");
  });

  it("produces machine-readable numbers", () => {
    expect(formatPlain(0.1 + 0.2)).toBe("0.3");
    expect(formatPlain(NaN)).toBe("");
    expect(formatPlain(1e-20)).toBe("1e-20");
  });
});

describe("report helpers", () => {
  it("formats R² with enough digits to tell good fits apart", () => {
    expect(formatRSquared(0.95)).toBe("0.9500");
    expect(formatRSquared(0.9982)).toBe("0.9982");
    expect(formatRSquared(0.999996)).toBe("0.9999960");
    expect(formatRSquared(1)).toBe("1.0000");
    expect(formatRSquared(NaN)).toBe("undefined");
  });

  it("writes fitted equations with proper signs", () => {
    expect(formatEquation("linear", [4.82, 0.13])).toBe("y = 4.820x + 0.1300");
    expect(formatEquation("quadratic", [4.9, -0.012, 0.008])).toBe("y = 4.900x² − 0.01200x + 0.008000");
    expect(formatEquation("linear", [2, 0.0008])).toBe("y = 2.000x + (8.000 × 10⁻⁴)");
    expect(formatEquation("exponential", [5, -0.4545])).toBe("y = 5.000·e^(−0.4545x)");
    expect(formatEquation("power", [2.006, 0.5])).toBe("y = 2.006·x^0.5000");
  });

  it("derives parameter units from the axis units", () => {
    expect(parameterUnits("linear", "s", "m")).toEqual(["m/s", "m"]);
    expect(parameterUnits("quadratic", "s", "m")).toEqual(["m/s²", "m/s", "m"]);
    expect(parameterUnits("exponential", "s", "V")).toEqual(["V", "1/s"]);
  });
});

describe("units", () => {
  it("extracts units from headers", () => {
    expect(parseHeaderUnit("time (s)")).toEqual({ name: "time", unit: "s" });
    expect(parseHeaderUnit("Velocity [m/s]")).toEqual({ name: "Velocity", unit: "m/s" });
    expect(parseHeaderUnit("mass")).toEqual({ name: "mass", unit: "" });
  });

  it("builds quotient units", () => {
    expect(quotientUnit("m", "s")).toBe("m/s");
    expect(quotientUnit("m", "s", 2)).toBe("m/s²");
    expect(quotientUnit("", "s")).toBe("1/s");
    expect(quotientUnit("m", "")).toBe("m");
    expect(quotientUnit("m/s", "s")).toBe("m/s²");
    expect(quotientUnit("m/s²", "s")).toBe("m/s³");
    expect(quotientUnit("1/s", "s", 2)).toBe("1/s³");
    expect(quotientUnit("m/s", "kg")).toBe("(m/s)/kg");
    expect(quotientUnit("m", "m")).toBe("");
  });
});

describe("uncertainty helpers", () => {
  it("expands absolute and percent uncertainties per reading", () => {
    expect(absoluteUncertainties([1, NaN, 3], { kind: "absolute", value: 0.1 })).toEqual([0.1, NaN, 0.1]);
    expect(absoluteUncertainties([10, -20], { kind: "percent", value: 5 })).toEqual([0.5, 1]);
    expect(absoluteUncertainties([1], { kind: "absolute", value: 0 })).toBeNull();
    expect(absoluteUncertainties([1], null)).toBeNull();
  });

  it("summarises percent uncertainty", () => {
    const s = percentUncertainty([1, 2, 4], { kind: "absolute", value: 0.1 });
    expect(s?.max).toBeCloseTo(10, 12);
    expect(s?.min).toBeCloseTo(2.5, 12);
    expect(s?.relativeToMean).toBeCloseTo((0.1 / (7 / 3)) * 100, 12);
  });

  it("excludes zero readings from percent uncertainty", () => {
    const s = percentUncertainty([0, 2], { kind: "absolute", value: 0.1 });
    expect(s?.max).toBeCloseTo(5, 12);
  });

  it("computes the reduced chi-square", () => {
    const c = chiSquare([0.1, -0.1, 0.2], [0.1, 0.1, 0.1], 2);
    expect(c?.chiSquare).toBeCloseTo(6, 12);
    expect(c?.degreesOfFreedom).toBe(1);
    expect(chiSquare([0.1, 0.2], [0.1, 0.1], 2)).toBeNull();
    expect(chiSquare([0.1, 0.2, 0.3], [0.1, 0, 0.1], 1)).toBeNull();
  });
});
