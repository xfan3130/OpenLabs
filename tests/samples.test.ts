import { describe, expect, it } from "vitest";
import { buildSampleDataset, SAMPLE_EXPERIMENTS } from "@/data/samples";
import { fitModel } from "@/lib/regression";

/** Parameters each sample was generated from (in MODEL_INFO order). */
const TRUE_PARAMS: Record<string, number[]> = {
  "constant-acceleration": [9.8 / 2, 0, 0],
  "hookes-law": [25, 0],
  "capacitor-discharge": [5, -1 / 2.2],
  pendulum: [(2 * Math.PI) / Math.sqrt(9.81), 0.5],
};

describe("sample experiments", () => {
  it("includes the Constant Acceleration Motion demo", () => {
    expect(SAMPLE_EXPERIMENTS.map((s) => s.name)).toContain("Constant Acceleration Motion");
  });

  for (const sample of SAMPLE_EXPERIMENTS) {
    it(`${sample.name}: is reproducible and its suggested fit recovers the true parameters`, () => {
      const a = buildSampleDataset(sample);
      const b = buildSampleDataset(sample);
      expect(a.columns.map((c) => c.values)).toEqual(b.columns.map((c) => c.values));
      expect(a.analysis.xColumnId).toBe(a.columns[0].id);
      expect(a.analysis.yColumnIds).toEqual([a.columns[1].id]);

      const out = fitModel(sample.suggestedModel, a.columns[0].values, a.columns[1].values);
      if (!out.ok) throw new Error(out.error);
      expect(out.result.rSquared).toBeGreaterThan(0.999);
      out.result.params.forEach((p, i) => {
        // Within 2 standard errors of the value used to generate the data.
        expect(Math.abs(p.value - TRUE_PARAMS[sample.id][i])).toBeLessThan(2 * p.stdError);
      });
    });
  }
});
