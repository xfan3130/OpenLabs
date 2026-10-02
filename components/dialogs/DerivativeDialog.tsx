"use client";

import { useMemo, useState } from "react";
import type { DataColumn, Dataset } from "@/types/dataset";
import { createNumericColumn } from "@/lib/dataset";
import { numericalDerivative } from "@/lib/derivative";
import { formatNumber } from "@/lib/format";
import { quotientUnit } from "@/lib/units";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Notice } from "@/components/shared/Section";

const PREVIEW_ROWS = 5;

export function DerivativeDialog({
  dataset,
  defaultXId,
  defaultYId,
  onClose,
  onCreate,
}: {
  dataset: Dataset;
  defaultXId: string | null;
  defaultYId: string | null;
  onClose: () => void;
  onCreate: (column: DataColumn, plot: boolean, xId: string) => void;
}) {
  const numeric = dataset.columns.filter((c) => c.kind === "numeric");
  const [xId, setXId] = useState(defaultXId ?? numeric[0]?.id ?? "");
  const [yId, setYId] = useState(defaultYId ?? numeric.find((c) => c.id !== xId)?.id ?? "");
  const [customName, setCustomName] = useState<string | null>(null);
  const [customUnit, setCustomUnit] = useState<string | null>(null);
  const [plot, setPlot] = useState(true);

  const x = numeric.find((c) => c.id === xId);
  const y = numeric.find((c) => c.id === yId);
  const name = customName ?? (x && y ? `d(${y.name})/d(${x.name})` : "");
  const unit = customUnit ?? (x && y ? quotientUnit(y.unit, x.unit) : "");

  const result = useMemo(() => {
    const xs = dataset.columns.find((c) => c.id === xId);
    const ys = dataset.columns.find((c) => c.id === yId);
    if (!xs || !ys) return null;
    if (xs.id === ys.id) return { ok: false as const, error: "Choose two different columns." };
    return numericalDerivative(xs.values, ys.values);
  }, [dataset.columns, xId, yId]);

  const canCreate = result?.ok === true && name.trim() !== "";

  const create = () => {
    if (!canCreate || !result?.ok || !x || !y) return;
    const column = createNumericColumn(dataset.columns, {
      name,
      unit,
      values: result.values,
      origin: { type: "derivative", ofColumn: y.name, withRespectTo: x.name },
    });
    onCreate(column, plot, x.id);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Numerical derivative</DialogTitle>
          <DialogDescription>
            Creates a new column dy/dx using finite differences: central differences for interior points and second-order
            one-sided differences at the two ends. Uneven spacing in x is handled exactly.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deriv-y">Differentiate (y)</Label>
              <NativeSelect id="deriv-y" value={yId} onChange={(e) => setYId(e.target.value)}>
                {numeric.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deriv-x">With respect to (x)</Label>
              <NativeSelect id="deriv-x" value={xId} onChange={(e) => setXId(e.target.value)}>
                {numeric.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deriv-name">New column name</Label>
              <Input id="deriv-name" value={name} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. velocity" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deriv-unit">Unit</Label>
              <Input id="deriv-unit" value={unit} onChange={(e) => setCustomUnit(e.target.value)} />
            </div>
          </div>

          <div aria-live="polite">
            {result?.ok === false && <Notice>{result.error}</Notice>}
            {result?.ok === true && (
              <div className="rounded-md border border-border bg-panel px-3 py-2 text-[13px]">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Preview (first {PREVIEW_ROWS} rows)</div>
                <ol className="grid grid-cols-5 gap-2 font-mono tabular-nums">
                  {result.values.slice(0, PREVIEW_ROWS).map((v, i) => (
                    <li key={i}>{formatNumber(v)}</li>
                  ))}
                </ol>
                {result.warnings.map((w) => (
                  <p key={w} className="mt-1.5 text-xs text-warning-foreground">
                    {w}
                  </p>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Differentiation amplifies measurement noise. If the result is very scattered, consider fitting a model to the
            original data and differentiating the fitted equation instead.
          </p>

          <div className="flex items-center gap-2">
            <Checkbox id="deriv-plot" checked={plot} onCheckedChange={(v) => setPlot(v === true)} />
            <label htmlFor="deriv-plot" className="cursor-pointer text-[13px]">
              Plot the derivative against {x?.name ?? "x"}
            </label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canCreate}>
              Create column
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
