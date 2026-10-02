"use client";

import { useState } from "react";
import type { PlotlyHTMLElement } from "plotly.js";
import { TriangleAlert } from "lucide-react";
import type { DataColumn, Dataset, PlotMode } from "@/types/dataset";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useWorkspace } from "@/hooks/useWorkspace";
import { buildSampleDataset, type SampleExperiment } from "@/data/samples";
import { datasetCsv, fitReportCsv, fitReportText, summaryText } from "@/lib/report";
import { downloadText, safeFileName } from "@/utils/browser";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopNav, type ExportActions } from "@/components/layout/TopNav";
import { CenterPanel } from "@/components/graph/CenterPanel";
import { downloadGraphPng } from "@/components/graph/graphActions";
import { DatasetPanel } from "@/components/sidebar/DatasetPanel";
import { VariablesPanel } from "@/components/sidebar/VariablesPanel";
import { GraphSettingsPanel } from "@/components/sidebar/GraphSettingsPanel";
import { FitPanel } from "@/components/sidebar/FitPanel";
import { UncertaintyPanel } from "@/components/sidebar/UncertaintyPanel";
import { StatisticsPanel } from "@/components/results/StatisticsPanel";
import { RegressionPanel } from "@/components/results/RegressionPanel";
import { UncertaintySummary } from "@/components/results/UncertaintySummary";
import { SummaryCard } from "@/components/results/SummaryCard";
import { ImportDialog } from "@/components/import/ImportDialog";
import { previewFile, type ImportPreview } from "@/components/import/readImport";
import { CalculatedColumnDialog } from "@/components/dialogs/CalculatedColumnDialog";
import { DerivativeDialog } from "@/components/dialogs/DerivativeDialog";
import { NewExperimentDialog } from "@/components/dialogs/NewExperimentDialog";
import { Notice } from "@/components/shared/Section";
import { EmptyState } from "./EmptyState";

type OpenDialog =
  | { kind: "import"; preview: ImportPreview | null }
  | { kind: "calculated" }
  | { kind: "derivative" }
  | { kind: "new" }
  | null;

function ImportNotes({ dataset }: { dataset: Dataset }) {
  if (dataset.importWarnings.length === 0) return null;
  return (
    <details className="border-b border-border px-4 py-2.5 text-[13px]">
      <summary className="flex cursor-pointer items-center gap-1.5 text-warning-foreground">
        <TriangleAlert className="size-3.5" aria-hidden />
        {dataset.importWarnings.length} import note{dataset.importWarnings.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-1.5 list-disc pl-5 text-xs leading-relaxed text-muted-foreground">
        {dataset.importWarnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </details>
  );
}

export default function Workspace() {
  const { state, dispatch, active } = useWorkspace();
  const analysis = useAnalysis(active);
  const [graphElement, setGraphElement] = useState<PlotlyHTMLElement | null>(null);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const { x, target, fit } = analysis;
  const fitResult = fit?.ok === true ? fit.result : null;

  const loadSample = (sample: SampleExperiment) => dispatch({ type: "addDataset", dataset: buildSampleDataset(sample) });

  const openImport = () => {
    setDropError(null);
    setDialog({ kind: "import", preview: null });
  };

  const handleDroppedFile = async (file: File | undefined) => {
    if (!file) return;
    const out = await previewFile(file);
    if (out.ok) {
      setDropError(null);
      setDialog({ kind: "import", preview: out.preview });
    } else {
      setDropError(out.error);
    }
  };

  const addColumn = (column: DataColumn, plot: boolean, xId?: string) => {
    if (!active) return;
    dispatch({ type: "addColumn", id: active.id, column });
    if (plot) {
      dispatch({
        type: "updateAnalysis",
        id: active.id,
        update: (a) => ({
          ...a,
          xColumnId: xId ?? a.xColumnId,
          yColumnIds: [column.id],
          fit: { ...a.fit, targetColumnId: column.id },
        }),
      });
    }
    setDialog(null);
  };

  const summary = active
    ? summaryText({ datasetName: active.name, x, y: target ?? analysis.ys[0] ?? null, fit: fitResult })
    : "";
  const slug = active ? safeFileName(active.name) : "openlab";
  const reportContext =
    active && fitResult && x && target
      ? { datasetName: active.name, x, y: target, fit: fitResult, chiSquare: analysis.chiSquare }
      : null;

  const exports: ExportActions = {
    datasetCsv: active
      ? () =>
          downloadText(
            datasetCsv(active, fitResult && target ? { result: fitResult, y: target } : null),
            `${slug}.csv`,
            "text/csv",
          )
      : undefined,
    graphPng: graphElement ? () => downloadGraphPng(graphElement, slug) : undefined,
    fitCsv: reportContext ? () => downloadText(fitReportCsv(reportContext), `${slug}-regression.csv`, "text/csv") : undefined,
    fitText: reportContext ? () => downloadText(fitReportText(reportContext), `${slug}-regression.txt`) : undefined,
    summary: active ? () => downloadText(summary + "\n", `${slug}-summary.txt`) : undefined,
  };

  return (
    <TooltipProvider>
      <div
        className="relative flex h-dvh flex-col"
        onDragOver={(e) => {
          if (dialog || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.relatedTarget === null) setDragging(false);
        }}
        onDrop={(e) => {
          if (dialog) return;
          e.preventDefault();
          setDragging(false);
          handleDroppedFile(e.dataTransfer.files[0]);
        }}
      >
        <TopNav
          onNewExperiment={() => (state.datasets.length > 0 ? setDialog({ kind: "new" }) : undefined)}
          onImport={openImport}
          exports={exports}
        />

        {dropError && (
          <div className="border-b border-border bg-card px-4 py-2">
            <Notice className="flex items-center justify-between gap-3">
              <span>{dropError}</span>
              <button type="button" className="cursor-pointer text-xs underline" onClick={() => setDropError(null)}>
                Dismiss
              </button>
            </Notice>
          </div>
        )}

        {active ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[18rem_minmax(0,1fr)_21rem] lg:overflow-hidden">
            <aside
              key={`left-${active.id}`}
              aria-label="Datasets and analysis controls"
              className="order-2 border-border bg-panel lg:order-none lg:overflow-y-auto lg:border-r"
            >
              <DatasetPanel
                datasets={state.datasets}
                activeId={state.activeId}
                dispatch={dispatch}
                onImport={openImport}
                onLoadSample={loadSample}
              />
              <ImportNotes dataset={active} />
              <VariablesPanel
                dataset={active}
                analysis={analysis}
                dispatch={dispatch}
                onNewCalculated={() => setDialog({ kind: "calculated" })}
                onNewDerivative={() => setDialog({ kind: "derivative" })}
              />
              <GraphSettingsPanel dataset={active} analysis={analysis} dispatch={dispatch} />
              <FitPanel dataset={active} analysis={analysis} dispatch={dispatch} />
              <UncertaintyPanel dataset={active} analysis={analysis} dispatch={dispatch} />
            </aside>

            <CenterPanel
              className="order-1 lg:order-none"
              dataset={active}
              analysis={analysis}
              graphElement={graphElement}
              onGraphReady={setGraphElement}
              onPlotModeChange={(plotMode: PlotMode) =>
                dispatch({ type: "updateAnalysis", id: active.id, update: (a) => ({ ...a, plotMode }) })
              }
            />

            <aside
              aria-label="Results"
              className="order-3 border-t border-border bg-panel lg:order-none lg:overflow-y-auto lg:border-l lg:border-t-0"
            >
              <StatisticsPanel x={x} ys={analysis.ys} colorOf={analysis.colorOf} />
              <RegressionPanel
                model={active.analysis.fit.model}
                outcome={fit}
                x={x}
                y={target}
                chiSquare={analysis.chiSquare}
              />
              <UncertaintySummary columns={[...(x ? [x] : []), ...analysis.ys]} />
              <SummaryCard text={summary} datasetName={active.name} />
            </aside>
          </div>
        ) : (
          <EmptyState onImport={openImport} onLoadSample={loadSample} />
        )}

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-primary/10 p-6">
            <div className="rounded-lg border-2 border-dashed border-primary bg-card px-8 py-6 text-center shadow-lg">
              <p className="text-[15px] font-medium">Drop a CSV file to import it</p>
            </div>
          </div>
        )}

        {dialog?.kind === "import" && (
          <ImportDialog
            initialPreview={dialog.preview}
            onClose={() => setDialog(null)}
            onImport={(dataset) => {
              dispatch({ type: "addDataset", dataset });
              setDialog(null);
            }}
          />
        )}
        {dialog?.kind === "calculated" && active && (
          <CalculatedColumnDialog
            dataset={active}
            xName={x?.name ?? null}
            onClose={() => setDialog(null)}
            onCreate={(column, plot) => addColumn(column, plot)}
          />
        )}
        {dialog?.kind === "derivative" && active && (
          <DerivativeDialog
            dataset={active}
            defaultXId={x?.id ?? null}
            defaultYId={target?.id ?? analysis.ys[0]?.id ?? null}
            onClose={() => setDialog(null)}
            onCreate={(column, plot, xId) => addColumn(column, plot, xId)}
          />
        )}
        {dialog?.kind === "new" && (
          <NewExperimentDialog
            datasetCount={state.datasets.length}
            onClose={() => setDialog(null)}
            onConfirm={() => {
              dispatch({ type: "reset" });
              setDialog(null);
            }}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
