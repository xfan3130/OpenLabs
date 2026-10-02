"use client";

import { useState } from "react";
import { FlaskConical, Pencil, Trash2, Upload } from "lucide-react";
import type { Dataset } from "@/types/dataset";
import type { WorkspaceAction } from "@/hooks/useWorkspace";
import { MODEL_INFO } from "@/lib/regression";
import { SAMPLE_EXPERIMENTS, type SampleExperiment } from "@/data/samples";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WithTooltip } from "@/components/ui/tooltip";
import { Section } from "@/components/shared/Section";
import { cn } from "@/utils/cn";

export function SampleMenu({
  onLoadSample,
  trigger,
}: {
  onLoadSample: (sample: SampleExperiment) => void;
  trigger: React.ReactElement;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuLabel>Sample experiments</DropdownMenuLabel>
        {SAMPLE_EXPERIMENTS.map((s) => (
          <DropdownMenuItem key={s.id} onSelect={() => onLoadSample(s)} className="flex-col items-start gap-0.5">
            <span className="font-medium">{s.name}</span>
            <span className="text-xs text-muted-foreground">Try a {MODEL_INFO[s.suggestedModel].label.toLowerCase()} fit</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DatasetRow({
  dataset,
  active,
  dispatch,
}: {
  dataset: Dataset;
  active: boolean;
  dispatch: React.Dispatch<WorkspaceAction>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dataset.name);
  const numeric = dataset.columns.filter((c) => c.kind === "numeric").length;

  const commit = () => {
    dispatch({ type: "renameDataset", id: dataset.id, name: draft });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="px-1 py-1">
        <Input
          autoFocus
          aria-label="Dataset name"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(dataset.name);
              setEditing(false);
            }
          }}
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1 transition-colors",
        active ? "bg-accent" : "hover:bg-muted",
      )}
    >
      <button
        type="button"
        aria-current={active ? "true" : undefined}
        onClick={() => dispatch({ type: "setActive", id: dataset.id })}
        className="flex min-w-0 flex-1 cursor-pointer flex-col items-start rounded-md px-2.5 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <span className={cn("w-full truncate text-[13px] font-medium", active && "text-accent-foreground")}>
          {dataset.name}
        </span>
        <span className="text-xs text-muted-foreground">
          {dataset.rowCount} rows · {numeric} numeric column{numeric === 1 ? "" : "s"}
        </span>
      </button>
      <WithTooltip label="Rename">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Rename ${dataset.name}`}
          onClick={() => {
            setDraft(dataset.name);
            setEditing(true);
          }}
        >
          <Pencil className="size-3.5" />
        </Button>
      </WithTooltip>
      <WithTooltip label="Remove dataset">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${dataset.name}`}
          onClick={() => dispatch({ type: "removeDataset", id: dataset.id })}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </WithTooltip>
    </li>
  );
}

export function DatasetPanel({
  datasets,
  activeId,
  dispatch,
  onImport,
  onLoadSample,
}: {
  datasets: Dataset[];
  activeId: string | null;
  dispatch: React.Dispatch<WorkspaceAction>;
  onImport: () => void;
  onLoadSample: (sample: SampleExperiment) => void;
}) {
  return (
    <Section
      title="Datasets"
      actions={
        <>
          <WithTooltip label="Import CSV">
            <Button variant="ghost" size="icon-sm" aria-label="Import CSV" onClick={onImport}>
              <Upload className="size-3.5" />
            </Button>
          </WithTooltip>
          <SampleMenu
            onLoadSample={onLoadSample}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label="Load a sample experiment">
                <FlaskConical className="size-3.5" />
              </Button>
            }
          />
        </>
      }
    >
      <ul className="-mx-1 flex flex-col gap-0.5">
        {datasets.map((d) => (
          <DatasetRow key={d.id} dataset={d} active={d.id === activeId} dispatch={dispatch} />
        ))}
      </ul>
    </Section>
  );
}
