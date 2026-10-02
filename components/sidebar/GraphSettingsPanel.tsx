"use client";

import type { AxisRange, Dataset, GraphSettings } from "@/types/dataset";
import type { DerivedAnalysis } from "@/hooks/useAnalysis";
import type { WorkspaceAction } from "@/hooks/useWorkspace";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberField } from "@/components/shared/NumberField";
import { Section } from "@/components/shared/Section";

function RangeRow({
  label,
  range,
  onChange,
}: {
  label: string;
  range: AxisRange;
  onChange: (range: AxisRange) => void;
}) {
  return (
    <div className="grid grid-cols-[1.5rem_1fr_1fr] items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <NumberField
        ariaLabel={`${label} axis minimum`}
        placeholder="auto min"
        value={range.min}
        onChange={(min) => onChange({ ...range, min })}
      />
      <NumberField
        ariaLabel={`${label} axis maximum`}
        placeholder="auto max"
        value={range.max}
        onChange={(max) => onChange({ ...range, max })}
      />
    </div>
  );
}

export function GraphSettingsPanel({
  dataset,
  analysis,
  dispatch,
}: {
  dataset: Dataset;
  analysis: DerivedAnalysis;
  dispatch: React.Dispatch<WorkspaceAction>;
}) {
  const g = dataset.analysis.graph;
  const { x, ys } = analysis;

  const updateGraph = (patch: Partial<GraphSettings>) =>
    dispatch({ type: "updateAnalysis", id: dataset.id, update: (a) => ({ ...a, graph: { ...a.graph, ...patch } }) });

  const setUnit = (columnIds: string[], unit: string) => {
    for (const columnId of columnIds) dispatch({ type: "updateColumn", id: dataset.id, columnId, patch: { unit } });
  };

  const yUnitValue = analysis.yUnit;
  const yUnitsDiffer = ys.length > 1 && new Set(ys.map((c) => c.unit)).size > 1;

  return (
    <Section title="Graph">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="graph-title">Title</Label>
          <Input
            id="graph-title"
            value={g.title}
            placeholder={analysis.title || "Graph title"}
            onChange={(e) => updateGraph({ title: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="x-label">X label</Label>
            <Input
              id="x-label"
              value={g.xLabel}
              placeholder={x?.name ?? "x"}
              disabled={!x}
              onChange={(e) => updateGraph({ xLabel: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="x-unit">X unit</Label>
            <Input
              id="x-unit"
              value={x?.unit ?? ""}
              placeholder="e.g. s"
              disabled={!x}
              onChange={(e) => x && setUnit([x.id], e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="y-label">Y label</Label>
            <Input
              id="y-label"
              value={g.yLabel}
              placeholder={ys.map((c) => c.name).join(", ") || "y"}
              disabled={ys.length === 0}
              onChange={(e) => updateGraph({ yLabel: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="y-unit">Y unit</Label>
            <Input
              id="y-unit"
              value={yUnitValue}
              placeholder={yUnitsDiffer ? "mixed" : "e.g. m"}
              disabled={ys.length === 0}
              title={ys.length > 1 ? "Applies to every plotted Y variable" : undefined}
              onChange={(e) =>
                setUnit(
                  ys.map((c) => c.id),
                  e.target.value,
                )
              }
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Axis ranges (leave blank for automatic)</span>
          <RangeRow label="X" range={g.xRange} onChange={(xRange) => updateGraph({ xRange })} />
          <RangeRow label="Y" range={g.yRange} onChange={(yRange) => updateGraph({ yRange })} />
        </div>
      </div>
    </Section>
  );
}
