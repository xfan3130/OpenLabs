"use client";

import { useMemo, useState } from "react";
import type { PlotlyHTMLElement } from "plotly.js";
import { ChartScatter, Hand, ImageDown, Maximize2, RotateCcw, Spline, Table2, TrendingUp, ZoomIn } from "lucide-react";
import type { Dataset, PlotMode } from "@/types/dataset";
import type { DerivedAnalysis } from "@/hooks/useAnalysis";
import { buildMainFigure, buildResidualFigure, plotConfig, type Figure } from "@/lib/plotting";
import { max, min } from "@/lib/statistics";
import { absoluteUncertainties } from "@/lib/uncertainty";
import { safeFileName } from "@/utils/browser";
import { cn } from "@/utils/cn";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { WithTooltip } from "@/components/ui/tooltip";
import { DataTable } from "@/components/data/DataTable";
import { PlotlyChart } from "./PlotlyChart";
import { autoscale, downloadGraphPng, resetView } from "./graphActions";

type DragMode = "zoom" | "pan";

export function CenterPanel({
  dataset,
  analysis,
  graphElement,
  onGraphReady,
  onPlotModeChange,
  className,
}: {
  className?: string;
  dataset: Dataset;
  analysis: DerivedAnalysis;
  graphElement: PlotlyHTMLElement | null;
  onGraphReady: (el: PlotlyHTMLElement | null) => void;
  onPlotModeChange: (mode: PlotMode) => void;
}) {
  const [tab, setTab] = useState<"graph" | "table">("graph");
  const [dragMode, setDragMode] = useState<DragMode>("zoom");
  const settings = dataset.analysis;
  const { x, ys, fit } = analysis;

  // Changing what is plotted resets zoom; anything else keeps the user's view.
  const revision = [
    dataset.id,
    x?.id,
    ys.map((c) => c.id).join(","),
    JSON.stringify(settings.graph.xRange),
    JSON.stringify(settings.graph.yRange),
  ].join("|");

  const mainFigure = useMemo<Figure | null>(() => {
    if (!x || ys.length === 0) return null;
    const errorX = settings.showErrorBars ? absoluteUncertainties(x.values, x.uncertainty) : null;
    const fig = buildMainFigure({
      x,
      series: ys.map((c) => ({
        column: c,
        color: analysis.colorOf(c.id),
        errorY: settings.showErrorBars ? absoluteUncertainties(c.values, c.uncertainty) : null,
      })),
      errorX,
      plotMode: settings.plotMode,
      title: analysis.title,
      xTitle: analysis.xTitle,
      yTitle: analysis.yTitle,
      xRange: settings.graph.xRange,
      yRange: settings.graph.yRange,
      fit:
        fit?.ok === true
          ? {
              model: fit.result.model,
              params: fit.result.params.map((p) => p.value),
              xMin: min(fit.result.x),
              xMax: max(fit.result.x),
              range: settings.fit.range,
            }
          : null,
      revision,
    });
    return { ...fig, layout: { ...fig.layout, dragmode: dragMode } };
  }, [x, ys, fit, analysis, settings, revision, dragMode]);

  const residualFigure = useMemo<Figure | null>(() => {
    if (!settings.fit.showResiduals || fit?.ok !== true || !analysis.target) return null;
    const fig = buildResidualFigure({
      fit: fit.result,
      color: analysis.colorOf(analysis.target.id),
      xTitle: analysis.xTitle,
      yUnit: analysis.target.unit,
      errorY: settings.showErrorBars
        ? absoluteUncertainties(analysis.target.values, analysis.target.uncertainty)
        : null,
      revision: `${revision}|residuals`,
    });
    return { ...fig, layout: { ...fig.layout, dragmode: dragMode } };
  }, [settings, fit, analysis, revision, dragMode]);

  const fileName = safeFileName(analysis.title || dataset.name, "graph");
  const config = useMemo(() => plotConfig(fileName), [fileName]);

  let emptyMessage: string | null = null;
  if (!x) emptyMessage = "Choose a variable for the x axis in the Variables panel.";
  else if (ys.length === 0) emptyMessage = "Tick at least one variable to plot on the y axis.";

  const graphDisabled = !graphElement || tab !== "graph";

  return (
    <main className={cn("flex min-h-[560px] min-w-0 flex-col bg-card lg:min-h-0", className)} aria-label="Graph and data">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "graph" | "table")}>
          <TabsList aria-label="View">
            <TabsTrigger value="graph">
              <TrendingUp /> Graph
            </TabsTrigger>
            <TabsTrigger value="table">
              <Table2 /> Data table
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "graph" && (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              aria-label="Plot style"
              className="w-auto"
              value={settings.plotMode}
              onValueChange={(v) => v && onPlotModeChange(v as PlotMode)}
            >
              <ToggleGroupItem value="markers" aria-label="Points">
                <ChartScatter /> Points
              </ToggleGroupItem>
              <ToggleGroupItem value="lines" aria-label="Connected line">
                <Spline /> Line
              </ToggleGroupItem>
              <ToggleGroupItem value="lines+markers" aria-label="Points and line">
                Both
              </ToggleGroupItem>
            </ToggleGroup>

            <ToggleGroup
              type="single"
              aria-label="Mouse drag action"
              className="w-auto"
              value={dragMode}
              onValueChange={(v) => v && setDragMode(v as DragMode)}
            >
              <ToggleGroupItem value="zoom" aria-label="Drag to zoom">
                <ZoomIn /> Zoom
              </ToggleGroupItem>
              <ToggleGroupItem value="pan" aria-label="Drag to pan">
                <Hand /> Pan
              </ToggleGroupItem>
            </ToggleGroup>

            <div className="flex items-center gap-1">
              <WithTooltip label="Autoscale: fit all data in view">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Autoscale"
                  disabled={graphDisabled}
                  onClick={() => graphElement && autoscale(graphElement)}
                >
                  <Maximize2 />
                </Button>
              </WithTooltip>
              <WithTooltip label="Reset view (also: double-click the graph)">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Reset view"
                  disabled={graphDisabled}
                  onClick={() => graphElement && resetView(graphElement, settings.graph.xRange, settings.graph.yRange)}
                >
                  <RotateCcw />
                </Button>
              </WithTooltip>
              <WithTooltip label="Download graph as PNG">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Download graph as PNG"
                  disabled={graphDisabled}
                  onClick={() => graphElement && downloadGraphPng(graphElement, fileName)}
                >
                  <ImageDown />
                </Button>
              </WithTooltip>
            </div>
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
        {mainFigure ? (
          <div className="flex min-h-0 flex-1 flex-col gap-1 p-2">
            <div className="min-h-[300px] flex-1">
              <PlotlyChart
                figure={mainFigure}
                config={config}
                ariaLabel={`Graph of ${analysis.title}`}
                onReady={onGraphReady}
              />
            </div>
            {residualFigure && (
              <div className="h-[30%] min-h-[180px] border-t border-border pt-1">
                <PlotlyChart figure={residualFigure} config={config} ariaLabel="Residual plot" />
              </div>
            )}
            {settings.fit.showResiduals && fit?.ok === false && (
              <p className="px-2 py-1 text-xs text-muted-foreground">Residuals are unavailable because the fit failed.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}

        {tab === "table" && (
          <div className="absolute inset-0 flex flex-col bg-card">
            <DataTable
              className="min-h-0 flex-1"
              columns={dataset.columns}
              rowCount={dataset.rowCount}
              highlightIds={[...(x ? [x.id] : []), ...ys.map((c) => c.id)]}
            />
          </div>
        )}
      </div>
    </main>
  );
}
