import { describe, expect, it } from "vitest";
import {
  describe as describeStats,
  finiteValues,
  max,
  mean,
  median,
  min,
  standardDeviation,
  standardError,
  sum,
  variance,
} from "@/lib/statistics";

describe("sum", () => {
  it("adds finite values and skips NaN / Infinity", () => {
    expect(sum([1, 2, 3, NaN, Infinity])).toBe(6);
  });

  it("is 0 for an empty array", () => {
    expect(sum([])).toBe(0);
  });

  it("compensates for floating-point cancellation", () => {
    // Naive summation returns 0 here; the exact answer is 2.
    expect(sum([1, 1e100, 1, -1e100])).toBe(2);
  });
});

describe("mean", () => {
  it("computes the arithmetic mean", () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
  });

  it("returns NaN for an empty array", () => {
    expect(mean([])).toBeNaN();
  });

  it("returns the value itself for one point", () => {
    expect(mean([3.7])).toBe(3.7);
  });

  it("ignores NaN values", () => {
    expect(mean([1, NaN, 3])).toBe(2);
  });

  it("returns NaN when every value is missing", () => {
    expect(mean([NaN, NaN])).toBeNaN();
  });
});

describe("median", () => {
  it("handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it("does not mutate its input", () => {
    const data = [3, 1, 2];
    median(data);
    expect(data).toEqual([3, 1, 2]);
  });

  it("returns NaN for an empty array", () => {
    expect(median([])).toBeNaN();
  });
});

describe("min / max", () => {
  it("finds extremes, ignoring NaN", () => {
    expect(min([3, NaN, -2, 7])).toBe(-2);
    expect(max([3, NaN, -2, 7])).toBe(7);
  });

  it("returns NaN when there are no finite values", () => {
    expect(min([])).toBeNaN();
    expect(max([NaN])).toBeNaN();
  });
});

describe("variance and standard deviation", () => {
  // Classic example: population SD is 2, sample variance is 32/7.
  const data = [2, 4, 4, 4, 5, 5, 7, 9];

  it("uses the sample (n − 1) definition", () => {
    expect(variance(data)).toBeCloseTo(32 / 7, 12);
    expect(standardDeviation(data)).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });

  it("is NaN for fewer than two points", () => {
    expect(variance([])).toBeNaN();
    expect(variance([5])).toBeNaN();
    expect(standardDeviation([5])).toBeNaN();
  });

  it("is zero for identical values", () => {
    expect(standardDeviation([4, 4, 4])).toBe(0);
  });

  it("is accurate when the mean is large compared with the spread", () => {
    // Textbook Σx² − n·x̄² formula fails badly here.
    const shifted = [1e9 + 4, 1e9 + 7, 1e9 + 13, 1e9 + 16];
    expect(variance(shifted)).toBeCloseTo(30, 6);
  });

  it("ignores NaN values", () => {
    expect(standardDeviation([2, 4, NaN, 4, 4, 5, 5, 7, 9])).toBeCloseTo(Math.sqrt(32 / 7), 12);
  });
});

describe("standardError", () => {
  it("is s / √n", () => {
    const data = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(standardError(data)).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
  });

  it("is NaN for one point", () => {
    expect(standardError([1])).toBeNaN();
  });
});

describe("describe", () => {
  it("reports every statistic and the number of missing values", () => {
    const s = describeStats([1, 2, 3, 4, NaN]);
    expect(s.n).toBe(4);
    expect(s.missing).toBe(1);
    expect(s.mean).toBe(2.5);
    expect(s.median).toBe(2.5);
    expect(s.min).toBe(1);
    expect(s.max).toBe(4);
    expect(s.range).toBe(3);
    expect(s.stdDev).toBeCloseTo(Math.sqrt(5 / 3), 12);
    expect(s.stdError).toBeCloseTo(Math.sqrt(5 / 3) / 2, 12);
  });

  it("returns NaN statistics for an empty column", () => {
    const s = describeStats([]);
    expect(s.n).toBe(0);
    expect(s.mean).toBeNaN();
    expect(s.range).toBeNaN();
    expect(s.stdDev).toBeNaN();
  });

  it("handles a single point", () => {
    const s = describeStats([42]);
    expect(s.n).toBe(1);
    expect(s.mean).toBe(42);
    expect(s.range).toBe(0);
    expect(s.stdDev).toBeNaN();
    expect(s.stdError).toBeNaN();
  });
});

describe("finiteValues", () => {
  it("drops NaN and infinities", () => {
    expect(finiteValues([1, NaN, -Infinity, 2, Infinity])).toEqual([1, 2]);
  });
});
