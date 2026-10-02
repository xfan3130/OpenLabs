import type { DataColumn } from "@/types/dataset";
import { formatNumber, formatPercent, withUnit } from "@/lib/format";
import { isValidUncertainty, percentUncertainty } from "@/lib/uncertainty";
import { Hint, Section } from "@/components/shared/Section";

function ColumnUncertainty({ column }: { column: DataColumn }) {
  const spec = column.uncertainty!;
  const summary = percentUncertainty(column.values, spec);
  if (!summary) return null;
  const stated =
    spec.kind === "absolute" ? withUnit(`± ${formatNumber(spec.value, 3)}`, column.unit) : `± ${formatPercent(spec.value)}`;
  const varies = spec.kind === "absolute" && Number.isFinite(summary.min) && summary.max / summary.min > 1.0001;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="truncate font-medium">{column.name}</span>
        <span className="font-mono tabular-nums">{stated}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="text-muted-foreground">Relative to mean</span>
        <span className="font-mono tabular-nums">{formatPercent(summary.relativeToMean)}</span>
      </div>
      {varies && (
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="text-muted-foreground">Per reading</span>
          <span className="font-mono tabular-nums">
            {formatPercent(summary.min)} – {formatPercent(summary.max)}
          </span>
        </div>
      )}
      {spec.kind === "percent" && (
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="text-muted-foreground">At the mean</span>
          <span className="font-mono tabular-nums">± {withUnit(formatNumber(summary.absoluteAtMean, 3), column.unit)}</span>
        </div>
      )}
    </div>
  );
}

export function UncertaintySummary({ columns }: { columns: DataColumn[] }) {
  const withUncertainty = columns.filter((c) => isValidUncertainty(c.uncertainty));
  return (
    <Section title="Uncertainty">
      {withUncertainty.length === 0 ? (
        <Hint>
          Enter measurement uncertainties under Measurement uncertainty to draw error bars and see percent uncertainties. Fitted
          parameter uncertainties are shown under Regression.
        </Hint>
      ) : (
        <div className="flex flex-col gap-3">
          {withUncertainty.map((c) => (
            <ColumnUncertainty key={c.id} column={c} />
          ))}
        </div>
      )}
    </Section>
  );
}
