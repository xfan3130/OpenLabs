"use client";

import { useEffect, useReducer } from "react";
import type { AnalysisSettings, DataColumn, Dataset } from "@/types/dataset";

/**
 * All workspace state lives in one reducer. It is autosaved to the
 * browser's localStorage (no server, no account) so a page refresh does not
 * lose a student's work.
 */

export interface WorkspaceState {
  datasets: Dataset[];
  activeId: string | null;
}

export type WorkspaceAction =
  | { type: "addDataset"; dataset: Dataset }
  | { type: "removeDataset"; id: string }
  | { type: "setActive"; id: string }
  | { type: "renameDataset"; id: string; name: string }
  | { type: "reset" }
  | { type: "updateAnalysis"; id: string; update: (analysis: AnalysisSettings) => AnalysisSettings }
  | { type: "addColumn"; id: string; column: DataColumn }
  | { type: "removeColumn"; id: string; columnId: string }
  | {
      type: "updateColumn";
      id: string;
      columnId: string;
      patch: Partial<Pick<DataColumn, "unit" | "uncertainty">>;
    };

const STORAGE_KEY = "openlab:workspace:v1";

export const EMPTY_WORKSPACE: WorkspaceState = { datasets: [], activeId: null };

function mapDataset(state: WorkspaceState, id: string, fn: (d: Dataset) => Dataset): WorkspaceState {
  return { ...state, datasets: state.datasets.map((d) => (d.id === id ? fn(d) : d)) };
}

/** Remove references to a deleted column from the analysis settings. */
function withoutColumn(dataset: Dataset, columnId: string): AnalysisSettings {
  const a = dataset.analysis;
  const remaining = dataset.columns.filter((c) => c.id !== columnId && c.kind === "numeric");
  const yColumnIds = a.yColumnIds.filter((id) => id !== columnId);
  const xColumnId =
    a.xColumnId === columnId ? (remaining.find((c) => !yColumnIds.includes(c.id))?.id ?? null) : a.xColumnId;
  const targetColumnId = a.fit.targetColumnId === columnId ? (yColumnIds[0] ?? null) : a.fit.targetColumnId;
  return { ...a, xColumnId, yColumnIds, fit: { ...a.fit, targetColumnId } };
}

export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  switch (action.type) {
    case "addDataset":
      return { datasets: [...state.datasets, action.dataset], activeId: action.dataset.id };
    case "removeDataset": {
      const datasets = state.datasets.filter((d) => d.id !== action.id);
      const activeId =
        state.activeId === action.id ? (datasets[datasets.length - 1]?.id ?? null) : state.activeId;
      return { datasets, activeId };
    }
    case "setActive":
      return state.datasets.some((d) => d.id === action.id) ? { ...state, activeId: action.id } : state;
    case "renameDataset":
      return mapDataset(state, action.id, (d) => ({ ...d, name: action.name.trim() || d.name }));
    case "reset":
      return EMPTY_WORKSPACE;
    case "updateAnalysis":
      return mapDataset(state, action.id, (d) => ({ ...d, analysis: action.update(d.analysis) }));
    case "addColumn":
      return mapDataset(state, action.id, (d) => ({ ...d, columns: [...d.columns, action.column] }));
    case "removeColumn":
      return mapDataset(state, action.id, (d) => ({
        ...d,
        analysis: withoutColumn(d, action.columnId),
        columns: d.columns.filter((c) => c.id !== action.columnId),
      }));
    case "updateColumn":
      return mapDataset(state, action.id, (d) => ({
        ...d,
        columns: d.columns.map((c) => (c.id === action.columnId ? { ...c, ...action.patch } : c)),
      }));
  }
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/** JSON has no NaN, so missing values are stored as null and restored on load. */
export function serializeWorkspace(state: WorkspaceState): string {
  return JSON.stringify(state, (_key, value) =>
    typeof value === "number" && !Number.isFinite(value) ? null : value,
  );
}

function isDataset(value: unknown): value is Dataset {
  const d = value as Dataset;
  return (
    !!d &&
    typeof d.id === "string" &&
    typeof d.name === "string" &&
    typeof d.rowCount === "number" &&
    Array.isArray(d.columns) &&
    d.columns.every((c) => c && typeof c.id === "string" && Array.isArray(c.values)) &&
    !!d.analysis &&
    !!d.analysis.fit &&
    !!d.analysis.graph
  );
}

export function deserializeWorkspace(text: string): WorkspaceState | null {
  const raw = JSON.parse(text) as { datasets?: unknown; activeId?: unknown };
  if (!raw || !Array.isArray(raw.datasets) || !raw.datasets.every(isDataset)) return null;
  const datasets = (raw.datasets as Dataset[]).map((d) => ({
    ...d,
    columns: d.columns.map((c) => ({
      ...c,
      values: c.values.map((v) => (typeof v === "number" ? v : NaN)),
    })),
  }));
  const activeId =
    typeof raw.activeId === "string" && datasets.some((d) => d.id === raw.activeId)
      ? raw.activeId
      : (datasets[0]?.id ?? null);
  return { datasets, activeId };
}

export function loadWorkspace(): WorkspaceState {
  try {
    const text = window.localStorage.getItem(STORAGE_KEY);
    if (!text) return EMPTY_WORKSPACE;
    return deserializeWorkspace(text) ?? EMPTY_WORKSPACE;
  } catch {
    return EMPTY_WORKSPACE;
  }
}

function saveWorkspace(state: WorkspaceState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeWorkspace(state));
  } catch {
    // Storage full or unavailable (private mode): autosave is best-effort.
  }
}

export function useWorkspace() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, loadWorkspace);

  useEffect(() => {
    const timer = window.setTimeout(() => saveWorkspace(state), 400);
    return () => window.clearTimeout(timer);
  }, [state]);

  const active = state.datasets.find((d) => d.id === state.activeId) ?? null;
  return { state, dispatch, active };
}
