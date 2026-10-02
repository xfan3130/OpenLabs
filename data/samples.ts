import type { Dataset, RegressionModel } from "@/types/dataset";
import { createDataset, createNumericColumn } from "@/lib/dataset";
import { gaussian, mulberry32, roundTo } from "@/lib/random";
import type { DataColumn } from "@/types/dataset";

/**
 * Built-in sample experiments. Each one is generated from a physical model
 * plus Gaussian "measurement noise" from a seeded generator, then rounded to
 * a realistic instrument resolution.
 */

interface SampleColumn {
  name: string;
  unit: string;
  values: number[];
}

export interface SampleExperiment {
  id: string;
  name: string;
  description: string;
  /** The model the data was generated from, suggested when the sample loads. */
  suggestedModel: RegressionModel;
  build: () => SampleColumn[];
}

function range(start: number, stop: number, step: number, decimals: number): number[] {
  const out: number[] = [];
  const n = Math.round((stop - start) / step);
  for (let i = 0; i <= n; i++) out.push(roundTo(start + i * step, decimals));
  return out;
}

export const SAMPLE_EXPERIMENTS: SampleExperiment[] = [
  {
    id: "constant-acceleration",
    name: "Constant Acceleration Motion",
    description:
      "A cart released from rest on a ramp, tracked by a motion sensor. Position follows x = ½at² with a ≈ 9.8 m/s² plus ~3 mm of sensor noise. Fit a quadratic: the x² coefficient is a/2.",
    suggestedModel: "quadratic",
    build: () => {
      const noise = gaussian(mulberry32(20240901));
      const a = 9.8;
      const t = range(0, 1.2, 0.05, 2);
      const x = t.map((ti) => roundTo(0.5 * a * ti * ti + 0.003 * noise(), 3));
      return [
        { name: "time", unit: "s", values: t },
        { name: "position", unit: "m", values: x },
      ];
    },
  },
  {
    id: "hookes-law",
    name: "Hooke's Law Spring",
    description:
      "Force applied to a spring versus its extension. F = kx with k ≈ 25 N/m and ±0.05 N force-sensor noise. Fit a line: the slope is the spring constant.",
    suggestedModel: "linear",
    build: () => {
      const noise = gaussian(mulberry32(1678));
      const k = 25;
      const ext = range(0.02, 0.2, 0.02, 2);
      const f = ext.map((e) => roundTo(k * e + 0.05 * noise(), 2));
      return [
        { name: "extension", unit: "m", values: ext },
        { name: "force", unit: "N", values: f },
      ];
    },
  },
  {
    id: "capacitor-discharge",
    name: "Capacitor Discharge",
    description:
      "Voltage across a 2.2 s time-constant RC circuit while discharging from 5 V: V = V₀e^(−t/RC). Fit an exponential: B = −1/RC.",
    suggestedModel: "exponential",
    build: () => {
      const noise = gaussian(mulberry32(4242));
      const tau = 2.2;
      const t = range(0, 10, 0.5, 1);
      const v = t.map((ti) => roundTo(Math.max(0.005, 5 * Math.exp(-ti / tau) * (1 + 0.01 * noise())), 3));
      return [
        { name: "time", unit: "s", values: t },
        { name: "voltage", unit: "V", values: v },
      ];
    },
  },
  {
    id: "pendulum",
    name: "Pendulum Period vs Length",
    description:
      "Period of a simple pendulum for different string lengths: T = 2π√(L/g). Fit a power law: the exponent should be close to 0.5.",
    suggestedModel: "power",
    build: () => {
      const noise = gaussian(mulberry32(981));
      const g = 9.81;
      const L = range(0.1, 1.0, 0.1, 2);
      const T = L.map((l) => roundTo(2 * Math.PI * Math.sqrt(l / g) + 0.01 * noise(), 3));
      return [
        { name: "length", unit: "m", values: L },
        { name: "period", unit: "s", values: T },
      ];
    },
  },
];

/** Create a fresh dataset for a sample, with axes chosen and its model suggested. */
export function buildSampleDataset(sample: SampleExperiment): Dataset {
  const cols: DataColumn[] = [];
  for (const c of sample.build()) {
    cols.push(createNumericColumn(cols, { ...c, origin: { type: "imported" } }));
  }
  const dataset = createDataset({
    name: sample.name,
    source: "sample",
    columns: cols,
    rowCount: cols[0].values.length,
  });
  return dataset;
}
