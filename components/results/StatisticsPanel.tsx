import type { DataColumn } from "@/types/dataset";
import { describe } from "@/lib/statistics";
import { formatMeasured, formatNumber, formatWithUncertainty, withUnit } from "@/lib/format";
import { Hint, Section } from "@/components/shared/Section";

function StatRow({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]" title={title}>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-right font-mono text-[13px] tabular-nums">{value}</dd>
    </div>
  );
}

function ColumnStats({ column, axis, color }: { column: DataColumn; axis: "x" | "y"; color?: string }) {
  const s = describe(column.values);
  const u = column.unit;
  return (
    <div className="flex flex-col">
      <h3 className="mb-1 flex items-center gap-2 text-[13px] font-medium">
        {color ? (
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        ) : (
          <span aria-hidden className="w-2.5 shrink-0 text-center text-[11px] text-muted-foreground">x</span>
        )}
        <span className="truncate">{column.name}</span>
        {u && <span className="text-xs font-normal text-muted-foreground">({u})</span>}
        <span className="sr-only">({axis} axis)</span>
      </h3>
      <dl className="flex flex-col">
        <StatRow label="N" value={s.missing > 0 ? `${s.n} (${s.missing} missing)` : String(s.n)} />
        <StatRow
          label="Mean ± SE"
          value={withUnit(formatWithUncertainty(s.mean, s.stdError), u)}
          title="Mean with its standard error"
        />
        <StatRow label="Median" value={withUnit(formatMeasured(s.median), u)} />
        <StatRow label="Minimum" value={withUnit(formatMeasured(s.min), u)} />
        <StatRow label="Maximum" value={withUnit(formatMeasured(s.max), u)} />
        <StatRow label="Range" value={withUnit(formatMeasured(s.range), u)} />
        <StatRow label="Std deviation" value={withUnit(formatNumber(s.stdDev), u)} title="Sample standard deviation (n − 1)" />
        <StatRow label="Std error" value={withUnit(formatNumber(s.stdError), u)} title="Standard error of the mean, s/√n" />
      </dl>
    </div>
  );
}

export function StatisticsPanel({
  x,
  ys,
  colorOf,
}: {
  x: DataColumn | null;
  ys: DataColumn[];
  colorOf: (id: string) => string;
}) {
  return (
    <Section title="Statistics">
      {!x && ys.length === 0 ? (
        <Hint>Select variables to see their statistics.</Hint>
      ) : (
        <div className="flex flex-col gap-4">
          {x && <ColumnStats column={x} axis="x" />}
          {ys.map((c) => (
            <ColumnStats key={c.id} column={c} axis="y" color={colorOf(c.id)} />
          ))}
        </div>
      )}
    </Section>
  );
}
