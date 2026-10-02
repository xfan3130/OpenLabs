"use client";

import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { copyToClipboard, downloadText, safeFileName } from "@/utils/browser";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/shared/Section";

/** The copyable experiment summary (dataset, equation, R², N, mean). */
export function SummaryCard({ text, datasetName }: { text: string; datasetName: string }) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    const ok = await copyToClipboard(text);
    setCopied(ok ? "copied" : "failed");
    window.setTimeout(() => setCopied("idle"), 1800);
  };

  return (
    <Section
      title="Experiment summary"
      className="border-b-0"
      actions={
        <>
          <Button variant="ghost" size="sm" onClick={copy} aria-live="polite">
            {copied === "copied" ? <Check className="text-success" /> : <Copy />}
            {copied === "copied" ? "Copied" : copied === "failed" ? "Copy failed" : "Copy"}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Download summary as text"
            onClick={() => downloadText(text, `${safeFileName(datasetName)}-summary.txt`)}
          >
            <Download className="size-3.5" />
          </Button>
        </>
      }
    >
      <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-panel px-3 py-2.5 font-mono text-[12.5px] leading-relaxed">
        {text}
      </pre>
    </Section>
  );
}
