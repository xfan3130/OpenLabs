import type { Dataset, DatasetSource } from "@/types/dataset";
import { importDelimitedText } from "@/lib/csv";
import { datasetNameFromFile } from "@/lib/dataset";

/** A parsed file or paste waiting for the user to confirm the import. */
export interface ImportPreview {
  dataset: Dataset;
  hasHeader: boolean;
  delimiter: string;
  fileName?: string;
}

export type PreviewOutcome = { ok: true; preview: ImportPreview } | { ok: false; error: string };

const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function previewText(text: string, name: string, source: DatasetSource, fileName?: string): PreviewOutcome {
  const out = importDelimitedText(text, name, source);
  if (!out.ok) return out;
  return { ok: true, preview: { dataset: out.dataset, hasHeader: out.hasHeader, delimiter: out.delimiter, fileName } };
}

/** Read and parse a user-selected or dropped file. */
export async function previewFile(file: File): Promise<PreviewOutcome> {
  if (/\.(xlsx?|ods|numbers)$/i.test(file.name)) {
    return {
      ok: false,
      error: "Spreadsheet files are not supported yet. In your spreadsheet app choose File → Save As / Download → CSV, then import that file.",
    };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, error: "This file is larger than 25 MB, which is too big to analyse comfortably in the browser." };
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: "The file could not be read." };
  }
  if (text.includes("\u0000")) {
    return { ok: false, error: "This looks like a binary file, not CSV text." };
  }
  return previewText(text, datasetNameFromFile(file.name), "file", file.name);
}

export function delimiterName(delimiter: string): string {
  switch (delimiter) {
    case ",":
      return "comma";
    case "\t":
      return "tab";
    case ";":
      return "semicolon";
    case "|":
      return "pipe";
    default:
      return `"${delimiter}"`;
  }
}
