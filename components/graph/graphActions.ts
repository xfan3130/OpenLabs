import type { PlotlyHTMLElement } from "plotly.js";
import type { AxisRange } from "@/types/dataset";
import { axisRangeProps } from "@/lib/plotting";
import { loadPlotly } from "./PlotlyChart";

/** Fit every trace (data, error bars, fit curve) into view. */
export async function autoscale(gd: PlotlyHTMLElement): Promise<void> {
  const Plotly = await loadPlotly();
  await Plotly.relayout(gd, { "xaxis.autorange": true, "yaxis.autorange": true } as never);
}

function axisUpdate(axis: "xaxis" | "yaxis", range: AxisRange): Record<string, unknown> {
  const props = axisRangeProps(range);
  const update: Record<string, unknown> = { [`${axis}.autorange`]: props.autorange };
  if (props.range) update[`${axis}.range`] = props.range;
  return update;
}

/** Return to the configured view: manual axis ranges if set, otherwise automatic. */
export async function resetView(gd: PlotlyHTMLElement, xRange: AxisRange, yRange: AxisRange): Promise<void> {
  const Plotly = await loadPlotly();
  await Plotly.relayout(gd, { ...axisUpdate("xaxis", xRange), ...axisUpdate("yaxis", yRange) } as never);
}

/** Download the graph as a high-resolution PNG at its on-screen size. */
export async function downloadGraphPng(gd: PlotlyHTMLElement, fileName: string): Promise<void> {
  const Plotly = await loadPlotly();
  // `scale` (supersampling for a sharp image) is supported by Plotly but missing from its type definitions.
  const options = {
    format: "png" as const,
    filename: fileName,
    width: Math.max(gd.clientWidth, 640),
    height: Math.max(gd.clientHeight, 420),
    scale: 2,
  };
  await Plotly.downloadImage(gd, options);
}
