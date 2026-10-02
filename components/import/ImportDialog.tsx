"use client";

import { useRef, useState } from "react";
import { ArrowLeft, ClipboardPaste, FileUp } from "lucide-react";
import type { Dataset } from "@/types/dataset";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data/DataTable";
import { Notice } from "@/components/shared/Section";
import { cn } from "@/utils/cn";
import { delimiterName, previewFile, previewText, type ImportPreview } from "./readImport";

const EXAMPLE = `time,position
0,0
0.1,0.06
0.2,0.21
0.3,0.45
0.4,0.82`;

function PreviewStep({
  preview,
  onBack,
  onConfirm,
}: {
  preview: ImportPreview;
  onBack: () => void;
  onConfirm: (dataset: Dataset) => void;
}) {
  const { dataset } = preview;
  const numeric = dataset.columns.filter((c) => c.kind === "numeric");
  const [name, setName] = useState(dataset.name);
  const [xId, setXId] = useState(dataset.analysis.xColumnId ?? "");
  const [yIds, setYIds] = useState<string[]>(dataset.analysis.yColumnIds);

  const confirm = () => {
    const ys = yIds.filter((id) => id !== xId);
    onConfirm({
      ...dataset,
      name: name.trim() || dataset.name,
      analysis: {
        ...dataset.analysis,
        xColumnId: xId || null,
        yColumnIds: ys,
        fit: { ...dataset.analysis.fit, targetColumnId: ys[0] ?? null },
      },
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="import-name">Dataset name</Label>
          <Input id="import-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <p className="text-[13px] text-muted-foreground">
          {dataset.rowCount} rows · {dataset.columns.length} columns ({numeric.length} numeric) ·{" "}
          {preview.hasHeader ? "header row detected" : "no header row (columns were named automatically)"} ·{" "}
          {delimiterName(preview.delimiter)}-separated
        </p>
        {dataset.importWarnings.length > 0 && (
          <Notice>
            <ul className="list-disc pl-4">
              {dataset.importWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </Notice>
        )}
        <div className="max-h-56 overflow-hidden rounded-md border border-border">
          <DataTable className="max-h-56" columns={dataset.columns} rowCount={dataset.rowCount} maxRows={8} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-x">X axis</Label>
            <NativeSelect
              id="import-x"
              value={xId}
              onChange={(e) => {
                setXId(e.target.value);
                setYIds((ids) => ids.filter((id) => id !== e.target.value));
              }}
            >
              {numeric.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.unit ? ` (${c.unit})` : ""}
                </option>
              ))}
            </NativeSelect>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-xs font-medium text-muted-foreground">Y axis</legend>
            {numeric
              .filter((c) => c.id !== xId)
              .map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`import-y-${c.id}`}
                    checked={yIds.includes(c.id)}
                    onCheckedChange={(v) =>
                      setYIds((ids) => (v === true ? [...ids, c.id] : ids.filter((id) => id !== c.id)))
                    }
                  />
                  <label htmlFor={`import-y-${c.id}`} className="cursor-pointer text-[13px]">
                    {c.name}
                    {c.unit && <span className="text-muted-foreground"> ({c.unit})</span>}
                  </label>
                </div>
              ))}
            {numeric.length < 2 && <span className="text-[13px] text-muted-foreground">Only one numeric column.</span>}
          </fieldset>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft /> Back
        </Button>
        <Button onClick={confirm}>Import dataset</Button>
      </DialogFooter>
    </>
  );
}

function SourceStep({ onPreview }: { onPreview: (preview: ImportPreview) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pasteName, setPasteName] = useState("Pasted data");

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const out = await previewFile(file);
    setBusy(false);
    if (out.ok) onPreview(out.preview);
    else setError(out.error);
  };

  const handlePaste = () => {
    const out = previewText(pasted, pasteName.trim() || "Pasted data", "paste");
    if (out.ok) onPreview(out.preview);
    else setError(out.error);
  };

  return (
    <Tabs defaultValue="file" onValueChange={() => setError(null)}>
      <TabsList className="self-start">
        <TabsTrigger value="file">
          <FileUp /> Upload file
        </TabsTrigger>
        <TabsTrigger value="paste">
          <ClipboardPaste /> Paste data
        </TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="flex flex-col gap-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setDragging(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-input px-6 py-10 text-center transition-colors",
            dragging && "border-ring bg-accent",
          )}
        >
          <FileUp className="size-6 text-muted-foreground" aria-hidden />
          <p className="text-[13px] text-muted-foreground">Drag a CSV file here, or</p>
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            {busy ? "Reading…" : "Choose a file"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">CSV, TSV or TXT · first row may contain column names, e.g. “time (s)”</p>
        </div>
      </TabsContent>

      <TabsContent value="paste" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paste-name">Dataset name</Label>
          <Input id="paste-name" value={pasteName} onChange={(e) => setPasteName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="paste-data">Data (copy cells from a spreadsheet, or type CSV)</Label>
          <textarea
            id="paste-data"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={EXAMPLE}
            spellCheck={false}
            rows={9}
            className="w-full resize-y rounded-md border border-input bg-card px-2.5 py-2 font-mono text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25"
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handlePaste} disabled={pasted.trim() === ""}>
            Preview
          </Button>
        </div>
      </TabsContent>

      {error && <Notice className="mt-1">{error}</Notice>}
    </Tabs>
  );
}

export function ImportDialog({
  initialPreview,
  onClose,
  onImport,
}: {
  initialPreview: ImportPreview | null;
  onClose: () => void;
  onImport: (dataset: Dataset) => void;
}) {
  const [preview, setPreview] = useState<ImportPreview | null>(initialPreview);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import data</DialogTitle>
          <DialogDescription>
            {preview
              ? `Check the preview${preview.fileName ? ` of ${preview.fileName}` : ""} and choose what to plot.`
              : "Load a CSV file or paste a table. Numeric columns are detected automatically."}
          </DialogDescription>
        </DialogHeader>
        {preview ? (
          <PreviewStep preview={preview} onBack={() => setPreview(null)} onConfirm={onImport} />
        ) : (
          <SourceStep onPreview={setPreview} />
        )}
      </DialogContent>
    </Dialog>
  );
}
