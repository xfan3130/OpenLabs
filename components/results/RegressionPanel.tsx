import type { DataColumn, RegressionModel } from "@/types/dataset";
import type { FitOutcome } from "@/types/analysis";
import type { ChiSquareResult } from "@/lib/uncertainty";
import { formatNumber, formatPercent, formatWithUncertainty } from "@/lib/format";
import { MODEL_INFO } from "@/lib/regression";
import { formatEquation, formatRSquared, parameterUnits } from "@/lib/report";
import { Hint, Notice, Section } from "@/components/shared/Section";

function Metric({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={title}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="font-mono text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}

export function RegressionPanel({
  model,
  outcome,
  x,
  y,
  chiSquare,
}: {
  model: RegressionModel | "none";
  outcome: FitOutcome | null;
  x: DataColumn | null;
  y: DataColumn | null;
  chiSquare: ChiSquareResult | null;
}) {
  if (model === "none" || !outcome || !x || !y) {
    return (
      <Section title="Regression">
        <Hint>Choose a model under Curve fit to fit the data. The best-fit curve is drawn on the graph.</Hint>
      </Section>
    );
  }

  if (!outcome.ok) {
    return (
      <Section title="Regression">
        <Notice>
          <span className="font-medium">{MODEL_INFO[model].label} fit unavailable.</span> {outcome.error}
        </Notice>
      </Section>
    );
  }

  const fit = outcome.result;
  const units = parameterUnits(fit.model, x.unit, y.unit);

  return (
    <Section title="Regression">
      <div className="flex flex-col gap-3">
        <div>
          <div className="text-xs text-muted-foreground">
            {MODEL_INFO[fit.model].label} · {MODEL_INFO[fit.model].form}
          </div>
          <output className="mt-1 block break-words rounded-md bg-muted px-2.5 py-2 font-mono text-[13px] leading-relaxed">
            {formatEquation(fit.model, fit.params.map((p) => p.value))}
          </output>
          <div className="mt-1 text-xs text-muted-foreground">
            x = {x.name}
            {x.unit ? ` (${x.unit})` : ""}, y = {y.name}
            {y.unit ? ` (${y.unit})` : ""}
          </div>
        </div>

        <table className="w-full text-[13px]">
          <caption className="sr-only">Fitted parameters with standard errors</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1 font-medium">Parameter</th>
              <th scope="col" className="pb-1 text-right font-medium">Value ± SE</th>
            </tr>
          </thead>
          <tbody>
            {fit.params.map((p, i) => {
              const rel = Number.isFinite(p.stdError) && p.value !== 0 ? (p.stdError / Math.abs(p.value)) * 100 : NaN;
              return (
                <tr key={p.symbol} className="border-t border-border align-top">
                  <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                    <span className="font-mono font-medium">{p.symbol}</span>{" "}
                    <span className="text-muted-foreground">{p.name}</span>
                  </th>
                  <td className="py-1.5 text-right font-mono tabular-nums">
                    {formatWithUncertainty(p.value, p.stdError)}
                    {units[i] && <span className="text-muted-foreground"> {units[i]}</span>}
                    {Number.isFinite(rel) && (
                      <div className="text-[11px] text-muted-foreground" title="Relative standard error">
                        {rel < 100 ? `±${formatPercent(rel)}` : "> 100 % (consistent with 0)"}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <dl className="flex flex-col border-t border-border pt-1.5">
          <Metric label="R²" value={formatRSquared(fit.rSquared)} title="Coefficient of determination in the original y units" />
          {fit.rSquaredLinearized !== undefined && (
            <Metric
              label="R² (linearised)"
              value={formatRSquared(fit.rSquaredLinearized)}
              title="R² of the straight-line fit to the log-transformed data"
            />
          )}
          <Metric label="N" value={String(fit.n)} />
          <Metric
            label="Residual std. error"
            value={`${formatNumber(fit.rmse)}${y.unit && Number.isFinite(fit.rmse) ? ` ${y.unit}` : ""}`}
            title="√(SSE / (N − parameters))"
          />
          {chiSquare && (
            <Metric
              label="Reduced χ²"
              value={`${formatNumber(chiSquare.reduced, 3)} (ν = ${chiSquare.degreesOfFreedom})`}
              title="χ²/ν using the y uncertainties; ≈ 1 means the scatter matches the stated uncertainty"
            />
          )}
        </dl>

        <p className="text-xs leading-relaxed text-muted-foreground">
          {fit.method}
          {fit.notes.map((n) => (
            <span key={n} className="block">
              {n}
            </span>
          ))}
        </p>
      </div>
    </Section>
  );
}
