"use client";

import type { Dataset, FitSettings, RegressionModel } from "@/types/dataset";
import type { DerivedAnalysis } from "@/hooks/useAnalysis";
import type { WorkspaceAction } from "@/hooks/useWorkspace";
import { MODEL_INFO, REGRESSION_MODELS } from "@/lib/regression";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { NumberField } from "@/components/shared/NumberField";
import { Hint, Section } from "@/components/shared/Section";

export function FitPanel({
  dataset,
  analysis,
  dispatch,
}: {
  dataset: Dataset;
  analysis: DerivedAnalysis;
  dispatch: React.Dispatch<WorkspaceAction>;
}) {
  const fit = dataset.analysis.fit;
  const { x, ys, target } = analysis;
  const disabled = !x || ys.length === 0;

  const updateFit = (patch: Partial<FitSettings>) =>
    dispatch({ type: "updateAnalysis", id: dataset.id, update: (a) => ({ ...a, fit: { ...a.fit, ...patch } }) });

  return (
    <Section title="Curve fit">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fit-model">Model</Label>
          <NativeSelect
            id="fit-model"
            value={fit.model}
            disabled={disabled}
            onChange={(e) => updateFit({ model: e.target.value as RegressionModel | "none" })}
          >
            <option value="none">None</option>
            {REGRESSION_MODELS.map((m) => (
              <option key={m} value={m}>
                {MODEL_INFO[m].label}: {MODEL_INFO[m].form}
              </option>
            ))}
          </NativeSelect>
          {disabled && <Hint className="text-xs">Plot at least one Y variable to fit a model.</Hint>}
        </div>

        {fit.model !== "none" && !disabled && (
          <>
            {ys.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fit-target">Fit to</Label>
                <NativeSelect
                  id="fit-target"
                  value={target?.id ?? ""}
                  onChange={(e) => updateFit({ targetColumnId: e.target.value })}
                >
                  {ys.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Fit only {x?.name ?? "x"} from … to … (optional)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <NumberField
                  ariaLabel="Fit range start"
                  placeholder="first point"
                  value={fit.range.min}
                  onChange={(min) => updateFit({ range: { ...fit.range, min } })}
                />
                <NumberField
                  ariaLabel="Fit range end"
                  placeholder="last point"
                  value={fit.range.max}
                  onChange={(max) => updateFit({ range: { ...fit.range, max } })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="show-residuals" className="text-[13px] text-foreground">
                Show residuals
              </Label>
              <Switch
                id="show-residuals"
                checked={fit.showResiduals}
                onCheckedChange={(showResiduals) => updateFit({ showResiduals })}
              />
            </div>
          </>
        )}
      </div>
    </Section>
  );
}
