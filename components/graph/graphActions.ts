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

/**
 * Fonts available to the image renderer. The on-screen web font cannot be
 * embedded in Plotly's SVG-to-PNG step, so text would be laid out with one
 * font and drawn with another (overlapping legend entries). Exporting with a
 * common system font keeps measurement and drawing consistent.
 */
const EXPORT_FONT = "Helvetica Neue, Helvetica, Arial, Liberation Sans, DejaVu Sans, sans-serif";

/** Download the graph as a high-resolution PNG at its on-screen size, keeping the current zoom. */
export async function downloadGraphPng(gd: PlotlyHTMLElement, fileName: string): Promise<void> {
  const Plotly = await loadPlotly();
  const figure = {
    data: gd.data,
    layout: { ...gd.layout, font: { ...gd.layout.font, family: EXPORT_FONT } },
  };
  // `scale` (supersampling for a sharp image) is supported by Plotly but missing from its type definitions.
  const options = {
    format: "png" as const,
    filename: fileName,
    width: Math.max(gd.clientWidth, 640),
    height: Math.max(gd.clientHeight, 420),
    scale: 2,
  };
  await Plotly.downloadImage(figure as never, options);
}
