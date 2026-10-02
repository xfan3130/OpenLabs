"use client";

import Link from "next/link";
import { BookOpen, ChevronDown, Download, FilePlus2, FileSpreadsheet, FileText, ImageDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "./Logo";

/** Export actions; an undefined action is shown disabled with the reason. */
export interface ExportActions {
  datasetCsv?: () => void;
  graphPng?: () => void;
  fitCsv?: () => void;
  fitText?: () => void;
  summary?: () => void;
}

export function TopNav({
  onNewExperiment,
  onImport,
  exports,
}: {
  onNewExperiment: () => void;
  onImport: () => void;
  exports: ExportActions;
}) {
  const anyExport = Object.values(exports).some(Boolean);
  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-card px-3 sm:gap-2 sm:px-4">
      <Link href="/" className="mr-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:mr-4" aria-label="OpenLab home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex min-w-0 items-center gap-1">
        <Button variant="ghost" onClick={onNewExperiment}>
          <FilePlus2 />
          <span className="hidden md:inline">New Experiment</span>
        </Button>
        <Button variant="ghost" onClick={onImport}>
          <Upload />
          <span className="hidden md:inline">Import CSV</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" disabled={!anyExport}>
              <Download />
              <span className="hidden md:inline">Export</span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Data</DropdownMenuLabel>
            <DropdownMenuItem disabled={!exports.datasetCsv} onSelect={exports.datasetCsv}>
              <FileSpreadsheet /> Analysed dataset (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!exports.graphPng} onSelect={exports.graphPng}>
              <ImageDown /> Graph (.png)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Results</DropdownMenuLabel>
            <DropdownMenuItem disabled={!exports.fitCsv} onSelect={exports.fitCsv}>
              <FileSpreadsheet /> Regression results (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!exports.fitText} onSelect={exports.fitText}>
              <FileText /> Regression report (.txt)
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!exports.summary} onSelect={exports.summary}>
              <FileText /> Experiment summary (.txt)
            </DropdownMenuItem>
            {(!exports.fitCsv || !exports.graphPng) && (
              <p className="px-2 pb-1 pt-2 text-xs text-muted-foreground">
                {!exports.fitCsv ? "Regression exports need a successful curve fit. " : ""}
                {!exports.graphPng ? "The PNG needs a graph on screen." : ""}
              </p>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" asChild>
          <Link href="/docs" target="_blank" rel="noopener">
            <BookOpen />
            <span className="hidden md:inline">Documentation</span>
          </Link>
        </Button>
      </nav>
    </header>
  );
}
