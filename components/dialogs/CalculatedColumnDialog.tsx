"use client";

import { useMemo, useRef, useState } from "react";
import type { DataColumn, Dataset } from "@/types/dataset";
import { createNumericColumn } from "@/lib/dataset";
import { evaluateExpression } from "@/lib/expressions";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Notice } from "@/components/shared/Section";

const PREVIEW_ROWS = 5;

export function CalculatedColumnDialog({
  dataset,
  xName,
  onClose,
  onCreate,
}: {
  dataset: Dataset;
  xName: string | null;
  onClose: () => void;
  onCreate: (column: DataColumn, plot: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [expression, setExpression] = useState("");
  const [plot, setPlot] = useState(true);
  const expressionRef = useRef<HTMLInputElement>(null);
  const numeric = dataset.columns.filter((c) => c.kind === "numeric");

  const result = useMemo(
    () => (expression.trim() ? evaluateExpression(expression, dataset.columns, dataset.rowCount) : null),
    [expression, dataset.columns, dataset.rowCount],
  );

  const insert = (text: string) => {
    const el = expressionRef.current;
    const start = el?.selectionStart ?? expression.length;
    const end = el?.selectionEnd ?? expression.length;
    const next = expression.slice(0, start) + text + expression.slice(end);
    setExpression(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const canCreate = name.trim() !== "" && result?.ok === true;

  const create = () => {
    if (!canCreate || !result?.ok) return;
    const column = createNumericColumn(dataset.columns, {
      name,
      unit,
      values: result.values,
      origin: { type: "expression", expression: expression.trim() },
    });
    onCreate(column, plot);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New calculated column</DialogTitle>
          <DialogDescription>
            Write a formula using column names. It is evaluated row by row, e.g.{" "}
            <code className="font-mono text-foreground">position / time</code> or{" "}
            <code className="font-mono text-foreground">0.5 * 9.8 * time^2</code>.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <div className="grid grid-cols-[1fr_7rem] gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calc-name">Name</Label>
              <Input id="calc-name" autoFocus value={name} placeholder="e.g. velocity" onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="calc-unit">Unit</Label>
              <Input id="calc-unit" value={unit} placeholder="e.g. m/s" onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="calc-expression">Expression</Label>
            <Input
              id="calc-expression"
              ref={expressionRef}
              value={expression}
              spellCheck={false}
              autoComplete="off"
              className="font-mono"
              placeholder="(position2 - position1) / time"
              aria-invalid={result?.ok === false || undefined}
              aria-describedby="calc-feedback"
              onChange={(e) => setExpression(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-1" aria-label="Insert a column name">
              <span className="mr-1 text-xs text-muted-foreground">Columns:</span>
              {numeric.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => insert(c.symbol)}
                  className="cursor-pointer rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/40"
                  title={`${c.name}${c.unit ? ` (${c.unit})` : ""}`}
                >
                  {c.symbol}
                </button>
              ))}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Operators <code className="font-mono">+ − * / ^</code> · functions <code className="font-mono">sqrt exp ln log10 abs sin cos tan</code>{" "}
              (radians) · <code className="font-mono">deg(x)</code>/<code className="font-mono">rad(x)</code> convert angles ·
              constants <code className="font-mono">pi e</code>
            </p>
          </div>

          <div id="calc-feedback" aria-live="polite">
            {result?.ok === false && <Notice>{result.error}</Notice>}
            {result?.ok === true && (
              <div className="rounded-md border border-border bg-panel px-3 py-2 text-[13px]">
                <div className="mb-1 text-xs font-medium text-muted-foreground">Preview (first {PREVIEW_ROWS} rows)</div>
                <ol className="grid grid-cols-5 gap-2 font-mono tabular-nums">
                  {result.values.slice(0, PREVIEW_ROWS).map((v, i) => (
                    <li key={i}>{formatNumber(v)}</li>
                  ))}
                </ol>
                {result.invalidCount > 0 && (
                  <p className="mt-1.5 text-xs text-warning-foreground">
                    {result.invalidCount} row{result.invalidCount === 1 ? "" : "s"} gave no real result (for example division
                    by zero or the log of a negative number) and will be left blank.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="calc-plot" checked={plot} onCheckedChange={(v) => setPlot(v === true)} />
            <label htmlFor="calc-plot" className="cursor-pointer text-[13px]">
              Plot the new column{xName ? ` against ${xName}` : ""}
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
