import Papa from "papaparse";
import type { DataColumn, Dataset, RegressionModel } from "@/types/dataset";
import type { FitResult } from "@/types/analysis";
import { formatNumber, formatPlain, formatWithUncertainty, MISSING } from "./format";
import { MODEL_INFO } from "./regression";
import { mean } from "./statistics";
import type { ChiSquareResult } from "./uncertainty";
import { absoluteUncertainties } from "./uncertainty";
import { labelWithUnit, quotientUnit } from "./units";

/**
 * Text and CSV output: fitted equations, regression reports, the dataset
 * export and the copyable experiment summary.
 */

/** Wrap scientific-notation numbers in parentheses so "2 × 10⁻³x" stays readable. */
function coefficient(value: number, sig: number): string {
  const text = formatNumber(Math.abs(value), sig);
  return text.includes("×") ? `(${text})` : text;
}

function signed(value: number, sig: number, first: boolean): string {
  const negative = value < 0;
  const body = coefficient(value, sig);
  if (first) return negative ? `−${body}` : body;
  return negative ? ` − ${body}` : ` + ${body}`;
}

/**
 * Fitted equation with numbers substituted, e.g. "y = 4.901x² + 0.0123x − 0.0008".
 * `params` are in MODEL_INFO display order.
 */
export function formatEquation(model: RegressionModel, params: readonly number[], sig = 4): string {
  if (!params.every(Number.isFinite)) return MODEL_INFO[model].form;
  switch (model) {
    case "linear": {
      const [m, b] = params;
      return `y = ${signed(m, sig, true)}x${signed(b, sig, false)}`;
    }
    case "quadratic": {
      const [a, b, c] = params;
      return `y = ${signed(a, sig, true)}x²${signed(b, sig, false)}x${signed(c, sig, false)}`;
    }
    case "exponential": {
      const [A, B] = params;
      return `y = ${signed(A, sig, true)}·e^(${signed(B, sig, true)}x)`;
    }
    case "power": {
      const [A, B] = params;
      return `y = ${signed(A, sig, true)}·x^${B < 0 ? `(${signed(B, sig, true)})` : coefficient(B, sig)}`;
    }
  }
}

/** Unit of each model parameter given the x and y units ("" when unknown or not simple). */
export function parameterUnits(model: RegressionModel, xUnit: string, yUnit: string): string[] {
  switch (model) {
    case "linear":
      return [quotientUnit(yUnit, xUnit), yUnit];
    case "quadratic":
      return [quotientUnit(yUnit, xUnit, 2), quotientUnit(yUnit, xUnit), yUnit];
    case "exponential":
      return [yUnit, xUnit ? quotientUnit("", xUnit) : ""];
    case "power":
      // A carries y·x⁻ᴮ, which depends on the fitted exponent; B is dimensionless.
      return ["", ""];
  }
}

/**
 * R² with enough decimals to show at least two significant digits of 1 − R²,
 * so good fits stay distinguishable (0.99982 vs 0.99991), between 4 and 8
 * decimals.
 */
export function formatRSquared(r2: number): string {
  if (!Number.isFinite(r2)) return "undefined";
  const shortfall = 1 - r2;
  const decimals = shortfall > 0 ? Math.min(8, Math.max(4, Math.ceil(-Math.log10(shortfall)) + 1)) : 4;
  return r2.toFixed(decimals);
}

export interface ReportContext {
  datasetName: string;
  x: DataColumn;
  y: DataColumn;
  fit: FitResult;
  chiSquare: ChiSquareResult | null;
}

function parameterLines(ctx: ReportContext): string[] {
  const units = parameterUnits(ctx.fit.model, ctx.x.unit, ctx.y.unit);
  return ctx.fit.params.map((p, i) => {
    const valueText = formatWithUncertainty(p.value, p.stdError);
    const unit = units[i] ? ` ${units[i]}` : "";
    const rel = Number.isFinite(p.stdError) && p.value !== 0 ? (p.stdError / Math.abs(p.value)) * 100 : NaN;
    const relative = Number.isFinite(rel) ? `  (${rel < 100 ? `${formatNumber(rel, 2)} %` : "> 100 %, consistent with 0"})` : "";
    return `  ${p.symbol} (${p.name}) = ${valueText}${unit}${relative}`;
  });
}

/** Full human-readable regression report. */
export function fitReportText(ctx: ReportContext): string {
  const { fit } = ctx;
  const lines = [
    `OpenLab regression report`,
    `Dataset: ${ctx.datasetName}`,
    `x: ${labelWithUnit(ctx.x.name, ctx.x.unit)}`,
    `y: ${labelWithUnit(ctx.y.name, ctx.y.unit)}`,
    ``,
    `Model: ${MODEL_INFO[fit.model].label}  (${MODEL_INFO[fit.model].form})`,
    `Fitted equation: ${formatEquation(fit.model, fit.params.map((p) => p.value))}`,
    ``,
    `Parameters (value ± standard error):`,
    ...parameterLines(ctx),
    ``,
    `R² = ${formatRSquared(fit.rSquared)}`,
  ];
  if (fit.rSquaredLinearized !== undefined) {
    lines.push(`R² of linearised fit = ${formatRSquared(fit.rSquaredLinearized)}`);
  }
  lines.push(
    `N = ${fit.n}`,
    `Residual standard error = ${formatNumber(fit.rmse)}${ctx.y.unit ? ` ${ctx.y.unit}` : ""}`,
  );
  if (ctx.chiSquare) {
    lines.push(
      `χ² = ${formatNumber(ctx.chiSquare.chiSquare)} with ν = ${ctx.chiSquare.degreesOfFreedom}; reduced χ²/ν = ${formatNumber(ctx.chiSquare.reduced, 3)}`,
    );
  }
  lines.push(``, `Method: ${fit.method}`);
  for (const note of fit.notes) lines.push(`Note: ${note}`);
  return lines.join("\n") + "\n";
}

/** Regression results as a two-section CSV (summary rows, then parameters). */
export function fitReportCsv(ctx: ReportContext): string {
  const { fit } = ctx;
  const units = parameterUnits(fit.model, ctx.x.unit, ctx.y.unit);
  const rows: (string | number)[][] = [
    ["quantity", "value", "standard_error", "unit"],
    ["dataset", ctx.datasetName, "", ""],
    ["x_column", ctx.x.name, "", ctx.x.unit],
    ["y_column", ctx.y.name, "", ctx.y.unit],
    ["model", MODEL_INFO[fit.model].label, "", ""],
    ["equation", formatEquation(fit.model, fit.params.map((p) => p.value), 6), "", ""],
    ...fit.params.map((p, i) => [p.symbol, formatPlain(p.value), formatPlain(p.stdError), units[i]]),
    ["r_squared", formatPlain(fit.rSquared), "", ""],
  ];
  if (fit.rSquaredLinearized !== undefined) rows.push(["r_squared_linearized", formatPlain(fit.rSquaredLinearized), "", ""]);
  rows.push(["n", fit.n, "", ""], ["residual_standard_error", formatPlain(fit.rmse), "", ctx.y.unit]);
  if (ctx.chiSquare) {
    rows.push(
      ["chi_square", formatPlain(ctx.chiSquare.chiSquare), "", ""],
      ["degrees_of_freedom", ctx.chiSquare.degreesOfFreedom, "", ""],
      ["reduced_chi_square", formatPlain(ctx.chiSquare.reduced), "", ""],
    );
  }
  rows.push(["method", fit.method, "", ""]);
  return withBom(Papa.unparse(rows));
}

/** Excel only detects UTF-8 (needed for units like Ω or °C) when a BOM is present. */
function withBom(text: string): string {
  return /[^\x00-\x7F]/.test(text) ? `﻿${text}` : text;
}

/**
 * The analysed dataset as CSV: every column (units in the header), plus
 * absolute uncertainty columns where set, plus fitted values and residuals
 * for the rows used in the current fit.
 */
export function datasetCsv(dataset: Dataset, fit: { result: FitResult; y: DataColumn } | null): string {
  const fields: string[] = [];
  const columns: string[][] = [];

  for (const c of dataset.columns) {
    fields.push(labelWithUnit(c.name, c.unit));
    columns.push(
      c.kind === "text" ? (c.text ?? []).slice() : c.values.map((v) => formatPlain(v)),
    );
    const unc = c.kind === "numeric" ? absoluteUncertainties(c.values, c.uncertainty) : null;
    if (unc) {
      fields.push(labelWithUnit(`${c.name} uncertainty`, c.unit));
      columns.push(unc.map((v) => formatPlain(v)));
    }
  }

  if (fit) {
    const fitted = new Array<string>(dataset.rowCount).fill("");
    const resid = new Array<string>(dataset.rowCount).fill("");
    fit.result.rowIndices.forEach((row, k) => {
      fitted[row] = formatPlain(fit.result.y[k] - fit.result.residuals[k]);
      resid[row] = formatPlain(fit.result.residuals[k]);
    });
    fields.push(labelWithUnit(`${fit.y.name} fit`, fit.y.unit), labelWithUnit(`${fit.y.name} residual`, fit.y.unit));
    columns.push(fitted, resid);
  }

  const data = Array.from({ length: dataset.rowCount }, (_, i) => columns.map((col) => col[i] ?? ""));
  return withBom(Papa.unparse({ fields, data }));
}

export interface SummaryContext {
  datasetName: string;
  x: DataColumn | null;
  y: DataColumn | null;
  fit: FitResult | null;
}

/** Short copyable summary, as shown on the results card. */
export function summaryText(ctx: SummaryContext): string {
  const lines = [ctx.datasetName];
  if (ctx.x && ctx.y) {
    lines.push(`x = ${labelWithUnit(ctx.x.name, ctx.x.unit)}, y = ${labelWithUnit(ctx.y.name, ctx.y.unit)}`);
  }
  if (ctx.fit) {
    lines.push(
      ``,
      `Regression (${MODEL_INFO[ctx.fit.model].label.toLowerCase()}):`,
      formatEquation(ctx.fit.model, ctx.fit.params.map((p) => p.value)),
      `R² = ${formatRSquared(ctx.fit.rSquared)}`,
      `N = ${ctx.fit.n}`,
    );
  } else if (ctx.y) {
    lines.push(``, `N = ${ctx.y.values.filter(Number.isFinite).length}`);
  }
  if (ctx.y) {
    const m = mean(ctx.y.values);
    const text = formatNumber(m);
    lines.push(`Mean ${ctx.y.name} = ${text}${ctx.y.unit && text !== MISSING ? ` ${ctx.y.unit}` : ""}`);
  }
  return lines.join("\n");
}
