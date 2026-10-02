import type { DataColumn } from "@/types/dataset";
import { formatPlain } from "@/lib/format";
import { cn } from "@/utils/cn";

const MAX_ROWS = 2000;

function originLabel(c: DataColumn): string | null {
  if (c.origin.type === "expression") return `= ${c.origin.expression}`;
  if (c.origin.type === "derivative") return `d(${c.origin.ofColumn})/d(${c.origin.withRespectTo})`;
  return null;
}

/** Spreadsheet-style read-only view of the dataset. */
export function DataTable({
  columns,
  rowCount,
  maxRows = MAX_ROWS,
  highlightIds = [],
  className,
}: {
  columns: DataColumn[];
  rowCount: number;
  maxRows?: number;
  highlightIds?: string[];
  className?: string;
}) {
  const shown = Math.min(rowCount, maxRows);
  return (
    <div className={cn("overflow-auto", className)}>
      <table className="w-max min-w-full border-separate border-spacing-0 text-[13px]">
        <thead className="sticky top-0 z-10 bg-panel">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 border-b border-r border-border bg-panel px-2 py-1.5 text-right text-[11px] font-medium text-muted-foreground"
            >
              #
            </th>
            {columns.map((c) => {
              const origin = originLabel(c);
              return (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    "border-b border-r border-border px-3 py-1.5 text-left align-bottom font-medium",
                    highlightIds.includes(c.id) && "bg-accent",
                  )}
                >
                  <div className="text-foreground">
                    {c.name}
                    {c.unit && <span className="font-normal text-muted-foreground"> ({c.unit})</span>}
                  </div>
                  <div className="max-w-[16rem] truncate text-[11px] font-normal text-muted-foreground" title={origin ?? undefined}>
                    {c.kind === "text" ? "text" : (origin ?? "numeric")}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: shown }, (_, i) => (
            <tr key={i} className="hover:bg-muted/60">
              <th
                scope="row"
                className="sticky left-0 border-b border-r border-border bg-panel px-2 py-1 text-right font-mono text-[11px] font-normal text-muted-foreground tabular-nums"
              >
                {i + 1}
              </th>
              {columns.map((c) => {
                const text = c.kind === "text" ? (c.text?.[i] ?? "") : formatPlain(c.values[i], 10);
                return (
                  <td
                    key={c.id}
                    className={cn(
                      "border-b border-r border-border px-3 py-1 font-mono tabular-nums",
                      c.kind === "numeric" ? "text-right" : "text-left",
                      highlightIds.includes(c.id) && "bg-accent/50",
                    )}
                  >
                    {text === "" ? <span className="text-muted-foreground/60">—</span> : text}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {rowCount > shown && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Showing the first {shown.toLocaleString()} of {rowCount.toLocaleString()} rows. Export the dataset as CSV to see all rows.
        </p>
      )}
    </div>
  );
}
