"use client";

import type { DataColumn, Dataset, UncertaintyKind } from "@/types/dataset";
import type { DerivedAnalysis } from "@/hooks/useAnalysis";
import type { WorkspaceAction } from "@/hooks/useWorkspace";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/shared/NumberField";
import { Hint, Section } from "@/components/shared/Section";

function UncertaintyRow({
  axis,
  column,
  onChange,
}: {
  axis: string;
  column: DataColumn;
  onChange: (kind: UncertaintyKind, value: number | null) => void;
}) {
  const spec = column.uncertainty;
  const kind = spec?.kind ?? "absolute";
  // A kind can be chosen before a value is typed; NaN (or null after a reload) means "no value yet".
  const value = spec && Number.isFinite(spec.value) ? spec.value : null;
  const id = `unc-${column.id}`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        <span className="text-foreground">{column.name}</span>
        <span className="font-normal">({axis})</span>
      </Label>
      <div className="grid grid-cols-[1fr_5.5rem] gap-2">
        <NumberField
          id={id}
          min={0}
          placeholder={kind === "absolute" ? `± value${column.unit ? ` in ${column.unit}` : ""}` : "± percent"}
          value={value}
          onChange={(v) => onChange(kind, v)}
        />
        <NativeSelect
          aria-label={`Uncertainty type for ${column.name}`}
          value={kind}
          onChange={(e) => onChange(e.target.value as UncertaintyKind, value)}
        >
          <option value="absolute">{column.unit ? `± ${column.unit}` : "± abs"}</option>
          <option value="percent">± %</option>
        </NativeSelect>
      </div>
    </div>
  );
}

export function UncertaintyPanel({
  dataset,
  analysis,
  dispatch,
}: {
  dataset: Dataset;
  analysis: DerivedAnalysis;
  dispatch: React.Dispatch<WorkspaceAction>;
}) {
  const { x, ys } = analysis;

  const setUncertainty = (column: DataColumn, kind: UncertaintyKind, value: number | null) =>
    dispatch({
      type: "updateColumn",
      id: dataset.id,
      columnId: column.id,
      patch: { uncertainty: value === null ? (kind === "absolute" ? null : { kind, value: NaN }) : { kind, value } },
    });

  return (
    <Section title="Measurement uncertainty">
      {!x ? (
        <Hint>Choose an x variable first.</Hint>
      ) : (
        <div className="flex flex-col gap-3">
          <UncertaintyRow axis="x" column={x} onChange={(k, v) => setUncertainty(x, k, v)} />
          {ys.map((c) => (
            <UncertaintyRow key={c.id} axis="y" column={c} onChange={(k, v) => setUncertainty(c, k, v)} />
          ))}
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="show-error-bars" className="text-[13px] text-foreground">
              Show error bars
            </Label>
            <Switch
              id="show-error-bars"
              checked={dataset.analysis.showErrorBars}
              onCheckedChange={(showErrorBars) =>
                dispatch({ type: "updateAnalysis", id: dataset.id, update: (a) => ({ ...a, showErrorBars }) })
              }
            />
          </div>
        </div>
      )}
    </Section>
  );
}
