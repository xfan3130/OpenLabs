"use client";

import { ArrowRight, Upload } from "lucide-react";
import { MODEL_INFO } from "@/lib/regression";
import { SAMPLE_EXPERIMENTS, type SampleExperiment } from "@/data/samples";
import { Button } from "@/components/ui/button";

/** Start screen shown when the workspace has no datasets. */
export function EmptyState({
  onImport,
  onLoadSample,
}: {
  onImport: () => void;
  onLoadSample: (sample: SampleExperiment) => void;
}) {
  return (
    <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-10 sm:py-16">
      <div className="w-full max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight">Start an experiment</h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
          Import a CSV file from your data logger or spreadsheet, or open a sample experiment. Your work stays in this
          browser — nothing is uploaded to a server.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_1.4fr]">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold">Your data</h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
              A CSV with one column per variable. Units in the header, like <code className="font-mono">time (s)</code>, are
              picked up automatically. You can also paste cells copied from a spreadsheet.
            </p>
            <Button className="mt-4" onClick={onImport}>
              <Upload /> Import CSV or paste data
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-[15px] font-semibold">Sample experiments</h2>
            <ul className="mt-2 flex flex-col">
              {SAMPLE_EXPERIMENTS.map((s) => (
                <li key={s.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onLoadSample(s)}
                    className="group flex w-full cursor-pointer items-start gap-3 rounded-md px-2 py-2.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <span className="flex-1">
                      <span className="block text-[13px] font-medium">{s.name}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.description}</span>
                    </span>
                    <span className="mt-0.5 flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
                      {MODEL_INFO[s.suggestedModel].label}
                      <ArrowRight className="size-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
