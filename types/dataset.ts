/**
 * Core data model for OpenLab.
 *
 * Numeric values are stored as plain `number[]`. A missing or unparseable
 * cell is represented by `NaN`, and every math routine in `lib/` ignores
 * non-finite values explicitly, so missing data never silently becomes 0.
 */

/** How a measurement uncertainty is expressed. */
export type UncertaintyKind = "absolute" | "percent";

export interface UncertaintySpec {
  kind: UncertaintyKind;
  /** Absolute value in the column's unit, or a percentage (e.g. 2 for ±2 %). */
  value: number;
}

/** Where a column's values came from. */
export type ColumnOrigin =
  | { type: "imported" }
  | { type: "expression"; expression: string }
  | { type: "derivative"; ofColumn: string; withRespectTo: string };

export interface DataColumn {
  id: string;
  /** Display name, e.g. "position". */
  name: string;
  /**
   * Identifier usable inside calculated-column expressions,
   * e.g. "position" or "temp_1". Unique within a dataset.
   */
  symbol: string;
  /** Unit string, e.g. "m" or "m/s". Empty when unknown. */
  unit: string;
  /** Text columns are shown in the table but cannot be plotted or analysed. */
  kind: "numeric" | "text";
  /** Numeric values (NaN = missing). For text columns every entry is NaN. */
  values: number[];
  /** Raw cell text, kept only for text columns. */
  text?: string[];
  origin: ColumnOrigin;
  /** Optional measurement uncertainty applied to every value in the column. */
  uncertainty: UncertaintySpec | null;
}

export type PlotMode = "markers" | "lines" | "lines+markers";

export type RegressionModel = "linear" | "quadratic" | "exponential" | "power";

export interface AxisRange {
  min: number | null;
  max: number | null;
}

export interface GraphSettings {
  /** Empty string means "use the automatic default". */
  title: string;
  xLabel: string;
  yLabel: string;
  xRange: AxisRange;
  yRange: AxisRange;
}

export interface FitSettings {
  model: RegressionModel | "none";
  /** Which of the plotted Y columns the model is fitted to. */
  targetColumnId: string | null;
  /** Optional x-interval restricting which points are used in the fit. */
  range: AxisRange;
  showResiduals: boolean;
}

/** Per-dataset analysis state, so switching datasets keeps each one's setup. */
export interface AnalysisSettings {
  xColumnId: string | null;
  yColumnIds: string[];
  plotMode: PlotMode;
  showErrorBars: boolean;
  graph: GraphSettings;
  fit: FitSettings;
}

export type DatasetSource = "file" | "paste" | "sample";

export interface Dataset {
  id: string;
  name: string;
  source: DatasetSource;
  rowCount: number;
  columns: DataColumn[];
  /** Problems found while importing (malformed rows, unparseable cells...). */
  importWarnings: string[];
  analysis: AnalysisSettings;
}
