import type {
  AnalysisSettings,
  ColumnOrigin,
  DataColumn,
  Dataset,
  DatasetSource,
} from "@/types/dataset";
import { RESERVED_SYMBOLS } from "./expressionNames";

/** Short random id. Uses crypto.randomUUID when available. */
export function createId(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}`;
}

/**
 * Turn a column name into an identifier usable in expressions:
 * "Position 1" → "Position_1", "2nd trial" → "c_2nd_trial".
 * Avoids clashes with existing symbols and with function / constant names.
 */
export function makeSymbol(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!base) base = "col";
  if (/^[0-9]/.test(base)) base = `c_${base}`;
  if (RESERVED_SYMBOLS.has(base)) base = `${base}_col`;
  let symbol = base;
  let k = 2;
  while (used.has(symbol)) symbol = `${base}_${k++}`;
  return symbol;
}

/** Make `name` unique among existing column names: "v" → "v (2)". */
export function uniqueColumnName(name: string, columns: readonly DataColumn[]): string {
  const names = new Set(columns.map((c) => c.name));
  if (!names.has(name)) return name;
  let k = 2;
  while (names.has(`${name} (${k})`)) k++;
  return `${name} (${k})`;
}

export function createNumericColumn(
  existing: readonly DataColumn[],
  props: { name: string; unit?: string; values: number[]; origin: ColumnOrigin },
): DataColumn {
  const name = uniqueColumnName(props.name.trim() || "Column", existing);
  return {
    id: createId("col"),
    name,
    symbol: makeSymbol(name, existing.map((c) => c.symbol)),
    unit: props.unit?.trim() ?? "",
    kind: "numeric",
    values: props.values,
    origin: props.origin,
    uncertainty: null,
  };
}

export function numericColumns(dataset: Dataset): DataColumn[] {
  return dataset.columns.filter((c) => c.kind === "numeric");
}

export function findColumn(dataset: Dataset, id: string | null | undefined): DataColumn | undefined {
  if (!id) return undefined;
  return dataset.columns.find((c) => c.id === id);
}

/** Sensible starting analysis: first numeric column on x, second on y. */
export function defaultAnalysis(columns: readonly DataColumn[]): AnalysisSettings {
  const numeric = columns.filter((c) => c.kind === "numeric");
  const x = numeric[0] ?? null;
  const y = numeric[1] ?? null;
  return {
    xColumnId: x?.id ?? null,
    yColumnIds: y ? [y.id] : [],
    plotMode: "markers",
    showErrorBars: true,
    graph: {
      title: "",
      xLabel: "",
      yLabel: "",
      xRange: { min: null, max: null },
      yRange: { min: null, max: null },
    },
    fit: {
      model: "none",
      targetColumnId: y?.id ?? null,
      range: { min: null, max: null },
      showResiduals: false,
    },
  };
}

export function createDataset(props: {
  name: string;
  source: DatasetSource;
  columns: DataColumn[];
  rowCount: number;
  importWarnings?: string[];
}): Dataset {
  return {
    id: createId("ds"),
    name: props.name,
    source: props.source,
    rowCount: props.rowCount,
    columns: props.columns,
    importWarnings: props.importWarnings ?? [],
    analysis: defaultAnalysis(props.columns),
  };
}

/** Strip the directory and extension from a file name: "lab3/run1.csv" → "run1". */
export function datasetNameFromFile(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? fileName;
  return base.replace(/\.[^.]+$/, "") || "Imported data";
}
