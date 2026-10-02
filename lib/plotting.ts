import type { Config, Data, Layout, Shape } from "plotly.js";
import type { AxisRange, DataColumn, PlotMode, RegressionModel } from "@/types/dataset";
import type { FitResult } from "@/types/analysis";
import { MODEL_INFO, sampleModel } from "./regression";
import { labelWithUnit } from "./units";

/**
 * Pure functions that turn analysis state into Plotly figure specs.
 * Keeping them free of React makes the plotting logic easy to test and
 * reuse (e.g. for PNG export).
 */

/** Categorical series colours, assigned in fixed order (validated for colour-vision deficiency). */
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
export const FIT_COLOR = "#26251f";

const INK = "#1b1b19";
const MUTED_INK = "#5f5e5a";
const GRID = "#e8e7e1";
const AXIS_LINE = "#b9b8b0";
const SURFACE = "#ffffff";

/**
 * Shared left margin so the main and residual plots line up vertically.
 * Axes still use automargin, which only widens it for unusually long labels.
 */
const PLOT_LEFT_MARGIN = 84;

/** Above this many points WebGL rendering keeps the graph responsive. */
const WEBGL_THRESHOLD = 5000;

export interface Figure {
  data: Data[];
  layout: Partial<Layout>;
}

export interface SeriesInput {
  column: DataColumn;
  color: string;
  /** Absolute y uncertainty per dataset row, or null for no error bars. */
  errorY: number[] | null;
}

export interface FitOverlay {
  model: RegressionModel;
  params: number[];
  /** x-extent of the points used in the fit; the curve is not extrapolated. */
  xMin: number;
  xMax: number;
  /** Highlight the fit interval when the fit was restricted to part of the data. */
  range: AxisRange | null;
}

export interface MainFigureInput {
  x: DataColumn;
  series: SeriesInput[];
  errorX: number[] | null;
  plotMode: PlotMode;
  title: string;
  xTitle: string;
  yTitle: string;
  xRange: AxisRange;
  yRange: AxisRange;
  fit: FitOverlay | null;
  /** Changing this key resets zoom/pan; keeping it preserves the user's view. */
  revision: string;
}

/** Plotly axis settings for an optional manual range (either end may be open). */
export function axisRangeProps(range: AxisRange): Record<string, unknown> {
  const lo = range.min !== null && Number.isFinite(range.min) ? range.min : null;
  const hi = range.max !== null && Number.isFinite(range.max) ? range.max : null;
  if (lo !== null && hi !== null && lo < hi) return { range: [lo, hi], autorange: false };
  if (lo !== null && hi === null) return { range: [lo, null], autorange: "max" };
  if (hi !== null && lo === null) return { range: [null, hi], autorange: "min" };
  return { autorange: true };
}

function axisStyle(title: string, range: AxisRange): Record<string, unknown> {
  return {
    title: { text: title, standoff: 10, font: { size: 13, color: INK } },
    showline: true,
    mirror: "ticks",
    linecolor: AXIS_LINE,
    linewidth: 1,
    ticks: "outside",
    tickcolor: AXIS_LINE,
    ticklen: 5,
    tickfont: { size: 11, color: MUTED_INK },
    gridcolor: GRID,
    zeroline: true,
    zerolinecolor: AXIS_LINE,
    zerolinewidth: 1,
    exponentformat: "power",
    automargin: true,
    ...axisRangeProps(range),
  };
}

function baseLayout(revision: string): Partial<Layout> {
  return {
    paper_bgcolor: SURFACE,
    plot_bgcolor: SURFACE,
    font: { size: 12, color: INK },
    hovermode: "closest",
    dragmode: "zoom",
    uirevision: revision,
    hoverlabel: {
      bgcolor: SURFACE,
      bordercolor: AXIS_LINE,
      font: { color: INK, size: 12 },
    },
    legend: {
      orientation: "h",
      x: 0,
      xanchor: "left",
      y: 1.02,
      yanchor: "bottom",
      font: { size: 12, color: INK },
      bgcolor: "rgba(0,0,0,0)",
    },
  };
}

function finiteRows(xs: readonly number[], ys: readonly number[]): number[] {
  const rows: number[] = [];
  const n = Math.min(xs.length, ys.length);
  for (let i = 0; i < n; i++) if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) rows.push(i);
  return rows;
}

function unitSuffix(unit: string): string {
  return unit ? ` ${unit}` : "";
}

/** Escape text for Plotly's HTML-like label markup. */
function escapeLabel(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function buildMainFigure(input: MainFigureInput): Figure {
  const data: Data[] = [];
  const xName = escapeLabel(input.x.name);

  for (const s of input.series) {
    const rows = finiteRows(input.x.values, s.column.values);
    const yName = escapeLabel(s.column.name);
    const ex = input.errorX ? rows.map((i) => (Number.isFinite(input.errorX![i]) ? input.errorX![i] : 0)) : null;
    const ey = s.errorY ? rows.map((i) => (Number.isFinite(s.errorY![i]) ? s.errorY![i] : 0)) : null;
    const hasErrors = !!(ex || ey);

    const xHover = `${xName} = %{x:.5~g}${ex ? " ± %{customdata[0]:.2~g}" : ""}${escapeLabel(unitSuffix(input.x.unit))}`;
    const yHover = `${yName} = %{y:.5~g}${ey ? " ± %{customdata[1]:.2~g}" : ""}${escapeLabel(unitSuffix(s.column.unit))}`;

    data.push({
      type: rows.length > WEBGL_THRESHOLD ? "scattergl" : "scatter",
      mode: input.plotMode,
      name: escapeLabel(labelWithUnit(s.column.name, s.column.unit)),
      x: rows.map((i) => input.x.values[i]),
      y: rows.map((i) => s.column.values[i]),
      customdata: hasErrors ? rows.map((_, k) => [ex ? ex[k] : 0, ey ? ey[k] : 0]) : undefined,
      marker: { color: s.color, size: 8, line: { color: SURFACE, width: 1 } },
      line: { color: s.color, width: 2 },
      error_x: ex ? { type: "data", array: ex, visible: true, color: s.color, thickness: 1.2, width: 3 } : undefined,
      error_y: ey ? { type: "data", array: ey, visible: true, color: s.color, thickness: 1.2, width: 3 } : undefined,
      hovertemplate: `${xHover}<br>${yHover}<extra></extra>`,
    } as Data);
  }

  const shapes: Partial<Shape>[] = [];
  if (input.fit) {
    const curve = sampleModel(input.fit.model, input.fit.params, input.fit.xMin, input.fit.xMax);
    data.push({
      type: "scatter",
      mode: "lines",
      name: `${MODEL_INFO[input.fit.model].label} fit`,
      x: curve.x,
      y: curve.y,
      line: { color: FIT_COLOR, width: 2 },
      hovertemplate: `Fit<br>x = %{x:.5~g}<br>ŷ = %{y:.5~g}<extra></extra>`,
    });
    const r = input.fit.range;
    if (r && (r.min !== null || r.max !== null)) {
      shapes.push({
        type: "rect",
        xref: "x",
        yref: "paper",
        x0: r.min ?? input.fit.xMin,
        x1: r.max ?? input.fit.xMax,
        y0: 0,
        y1: 1,
        fillcolor: "rgba(42, 120, 214, 0.07)",
        line: { width: 0 },
        layer: "below",
      });
    }
  }

  const showLegend = data.length > 1;
  const layout: Partial<Layout> = {
    ...baseLayout(input.revision),
    title: input.title
      ? { text: escapeLabel(input.title), x: 0.01, xanchor: "left", font: { size: 15, color: INK } }
      : undefined,
    showlegend: showLegend,
    margin: { l: PLOT_LEFT_MARGIN, r: 16, t: (input.title ? 44 : 12) + (showLegend ? 28 : 0), b: 16 },
    xaxis: axisStyle(escapeLabel(input.xTitle), input.xRange) as Partial<Layout["xaxis"]>,
    yaxis: axisStyle(escapeLabel(input.yTitle), input.yRange) as Partial<Layout["yaxis"]>,
    shapes,
  };
  return { data, layout };
}

export interface ResidualFigureInput {
  fit: FitResult;
  color: string;
  xTitle: string;
  yUnit: string;
  /** Absolute y uncertainty per dataset row (mapped through fit.rowIndices). */
  errorY: number[] | null;
  revision: string;
}

/** Residuals rᵢ = yᵢ − ŷᵢ against x, with a reference line at zero. */
export function buildResidualFigure(input: ResidualFigureInput): Figure {
  const { fit } = input;
  const ey = input.errorY ? fit.rowIndices.map((row) => (Number.isFinite(input.errorY![row]) ? input.errorY![row] : 0)) : null;
  const data: Data[] = [
    {
      type: fit.x.length > WEBGL_THRESHOLD ? "scattergl" : "scatter",
      mode: "markers",
      name: "Residual",
      x: fit.x,
      y: fit.residuals,
      marker: { color: input.color, size: 7, line: { color: SURFACE, width: 1 } },
      error_y: ey ? { type: "data", array: ey, visible: true, color: input.color, thickness: 1.2, width: 3 } : undefined,
      hovertemplate: `x = %{x:.5~g}<br>residual = %{y:.4~g}${escapeLabel(unitSuffix(input.yUnit))}<extra></extra>`,
    } as Data,
  ];
  const layout: Partial<Layout> = {
    ...baseLayout(input.revision),
    showlegend: false,
    margin: { l: PLOT_LEFT_MARGIN, r: 16, t: 12, b: 16 },
    xaxis: { ...axisStyle(escapeLabel(input.xTitle), { min: null, max: null }), zeroline: false } as Partial<Layout["xaxis"]>,
    yaxis: {
      ...axisStyle(escapeLabel(labelWithUnit("Residual", input.yUnit)), { min: null, max: null }),
      zeroline: false,
    } as Partial<Layout["yaxis"]>,
    shapes: [
      {
        type: "line",
        xref: "paper",
        yref: "y",
        x0: 0,
        x1: 1,
        y0: 0,
        y1: 0,
        line: { color: FIT_COLOR, width: 1.5, dash: "dash" },
      },
    ],
  };
  return { data, layout };
}

export function plotConfig(fileName: string): Partial<Config> {
  return {
    responsive: true,
    displaylogo: false,
    displayModeBar: false,
    scrollZoom: true,
    doubleClick: "reset+autosize",
    toImageButtonOptions: { format: "png", filename: fileName, scale: 2 },
  };
}
