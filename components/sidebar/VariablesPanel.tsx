"use client";

import { Calculator, Sigma, Trash2 } from "lucide-react";
import type { DataColumn, Dataset } from "@/types/dataset";
import type { DerivedAnalysis } from "@/hooks/useAnalysis";
import type { WorkspaceAction } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { WithTooltip } from "@/components/ui/tooltip";
import { Hint, Section } from "@/components/shared/Section";

function originTag(c: DataColumn): string | null {
  if (c.origin.type === "expression") return "calc";
  if (c.origin.type === "derivative") return "d/dx";
  return null;
}

export function VariablesPanel({
  dataset,
  analysis,
  dispatch,
  onNewCalculated,
  onNewDerivative,
}: {
  dataset: Dataset;
  analysis: DerivedAnalysis;
  dispatch: React.Dispatch<WorkspaceAction>;
  onNewCalculated: () => void;
  onNewDerivative: () => void;
}) {
  const numeric = dataset.columns.filter((c) => c.kind === "numeric");
  const textCount = dataset.columns.length - numeric.length;
  const xId = analysis.x?.id ?? "";
  const ySet = new Set(dataset.analysis.yColumnIds);

  const setX = (id: string) =>
    dispatch({
      type: "updateAnalysis",
      id: dataset.id,
      update: (a) => {
        const yColumnIds = a.yColumnIds.filter((y) => y !== id);
        return {
          ...a,
          xColumnId: id || null,
          yColumnIds,
          fit: { ...a.fit, targetColumnId: yColumnIds.includes(a.fit.targetColumnId ?? "") ? a.fit.targetColumnId : (yColumnIds[0] ?? null) },
        };
      },
    });

  const toggleY = (id: string, checked: boolean) =>
    dispatch({
      type: "updateAnalysis",
      id: dataset.id,
      update: (a) => {
        const yColumnIds = checked ? [...a.yColumnIds.filter((y) => y !== id), id] : a.yColumnIds.filter((y) => y !== id);
        const targetValid = a.fit.targetColumnId !== null && yColumnIds.includes(a.fit.targetColumnId);
        return { ...a, yColumnIds, fit: { ...a.fit, targetColumnId: targetValid ? a.fit.targetColumnId : (yColumnIds[0] ?? null) } };
      },
    });

  return (
    <Section title="Variables">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="x-variable">X axis</Label>
          <NativeSelect id="x-variable" value={xId} onChange={(e) => setX(e.target.value)}>
            {!xId && <option value="">Choose…</option>}
            {numeric.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.unit ? ` (${c.unit})` : ""}
              </option>
            ))}
          </NativeSelect>
        </div>

        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Y axis</legend>
          {numeric.filter((c) => c.id !== xId).length === 0 && <Hint>Add another numeric column to plot.</Hint>}
          <ul className="flex flex-col">
            {numeric
              .filter((c) => c.id !== xId)
              .map((c) => {
                const checked = ySet.has(c.id);
                const tag = originTag(c);
                const inputId = `y-${c.id}`;
                return (
                  <li key={c.id} className="group -mx-1 flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted">
                    <Checkbox
                      id={inputId}
                      checked={checked}
                      onCheckedChange={(v) => toggleY(c.id, v === true)}
                      style={{ "--checkbox-color": analysis.colorOf(c.id) } as React.CSSProperties}
                    />
                    <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer items-baseline gap-1.5 py-1 text-[13px]">
                      <span className="truncate">{c.name}</span>
                      {c.unit && <span className="shrink-0 text-xs text-muted-foreground">({c.unit})</span>}
                      {tag && (
                        <span className="shrink-0 rounded bg-secondary px-1 font-mono text-[10px] text-muted-foreground">{tag}</span>
                      )}
                    </label>
                    {c.origin.type !== "imported" && (
                      <WithTooltip label="Delete column">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="size-6 opacity-60 hover:opacity-100 focus-visible:opacity-100"
                          aria-label={`Delete column ${c.name}`}
                          onClick={() => dispatch({ type: "removeColumn", id: dataset.id, columnId: c.id })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </WithTooltip>
                    )}
                  </li>
                );
              })}
          </ul>
          {textCount > 0 && (
            <Hint className="mt-1 text-xs">
              {textCount} text column{textCount === 1 ? "" : "s"} shown in the data table only.
            </Hint>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onNewCalculated}>
            <Calculator /> Calculated
          </Button>
          <Button variant="outline" size="sm" onClick={onNewDerivative}>
            <Sigma /> Derivative
          </Button>
        </div>
      </div>
    </Section>
  );
}
