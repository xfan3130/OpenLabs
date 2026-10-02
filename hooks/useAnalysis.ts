"use client";

import { useMemo } from "react";
import type { DataColumn, Dataset } from "@/types/dataset";
import type { FitOutcome } from "@/types/analysis";
import { findColumn } from "@/lib/dataset";
import { SERIES_COLORS } from "@/lib/plotting";
import { fitModel } from "@/lib/regression";
import { absoluteUncertainties, chiSquare, type ChiSquareResult } from "@/lib/uncertainty";
import { labelWithUnit } from "@/lib/units";

/**
 * Everything derived from the active dataset's analysis settings: the
 * resolved columns, colours, the regression and the axis labels. Computed
 * here once so the graph, the results panels and the exports agree.
 */
export interface DerivedAnalysis {
  x: DataColumn | null;
  ys: DataColumn[];
  /** The Y column the model is fitted to. */
  target: DataColumn | null;
  colorOf: (columnId: string) => string;
  fit: FitOutcome | null;
  chiSquare: ChiSquareResult | null;
  /** Unit shared by every plotted Y column, or "" if they differ. */
  yUnit: string;
  xTitle: string;
  yTitle: string;
  title: string;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function useAnalysis(dataset: Dataset | null): DerivedAnalysis {
  return useMemo(() => deriveAnalysis(dataset), [dataset]);
}

export function deriveAnalysis(dataset: Dataset | null): DerivedAnalysis {
  const empty: DerivedAnalysis = {
    x: null,
    ys: [],
    target: null,
    colorOf: () => SERIES_COLORS[0],
    fit: null,
    chiSquare: null,
    yUnit: "",
    xTitle: "",
    yTitle: "",
    title: "",
  };
  if (!dataset) return empty;

  const a = dataset.analysis;
  const numeric = dataset.columns.filter((c) => c.kind === "numeric");
  const xCandidate = findColumn(dataset, a.xColumnId);
  const x = xCandidate && xCandidate.kind === "numeric" ? xCandidate : null;
  const ys = a.yColumnIds
    .map((id) => numeric.find((c) => c.id === id))
    .filter((c): c is DataColumn => !!c && c.id !== x?.id);
  const target = ys.find((c) => c.id === a.fit.targetColumnId) ?? ys[0] ?? null;

  // Colour follows the column (its position among the non-x numeric
  // columns), so toggling other series never repaints this one.
  const colorSlots = new Map(
    numeric.filter((c) => c.id !== x?.id).map((c, i) => [c.id, SERIES_COLORS[i % SERIES_COLORS.length]]),
  );
  const colorOf = (id: string) => colorSlots.get(id) ?? SERIES_COLORS[0];

  let fit: FitOutcome | null = null;
  let chi: ChiSquareResult | null = null;
  if (a.fit.model !== "none" && x && target) {
    fit = fitModel(a.fit.model, x.values, target.values, a.fit.range);
    const sigmas = absoluteUncertainties(target.values, target.uncertainty);
    if (fit.ok && sigmas) {
      chi = chiSquare(
        fit.result.residuals,
        fit.result.rowIndices.map((row) => sigmas[row]),
        fit.result.params.length,
      );
    }
  }

  const units = new Set(ys.map((c) => c.unit));
  const yUnit = units.size === 1 ? [...units][0] : "";
  const defaultYLabel = ys.length <= 3 ? ys.map((c) => c.name).join(", ") : `${ys.length} variables`;
  const xLabel = x ? a.graph.xLabel.trim() || x.name : "";
  const yLabel = a.graph.yLabel.trim() || defaultYLabel;
  const xTitle = x ? labelWithUnit(xLabel, x.unit) : "";
  const yTitle = ys.length ? labelWithUnit(yLabel, yUnit) : "";
  const autoTitle = x && ys.length ? capitalize(`${yLabel} vs ${xLabel}`) : dataset.name;

  return {
    x,
    ys,
    target,
    colorOf,
    fit,
    chiSquare: chi,
    yUnit,
    xTitle,
    yTitle,
    title: a.graph.title.trim() || autoTitle,
  };
}
