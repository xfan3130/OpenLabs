import Papa from "papaparse";
import type { DataColumn, Dataset, DatasetSource } from "@/types/dataset";
import { createDataset, createId, makeSymbol } from "./dataset";
import { parseHeaderUnit } from "./units";

/**
 * CSV / delimited-text import.
 *
 * Papa Parse does the tokenising (quotes, delimiters, line endings); this
 * module decides what the cells mean: whether the first row is a header,
 * which columns are numeric, and how to repair malformed rows.
 */

/** Cells that mean "no value" rather than "not a number". */
const MISSING_TOKENS = new Set(["", "na", "n/a", "nan", "null", "none", "-", "—", "?"]);

const NUMBER_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;

/** Fraction of non-empty cells that must be numbers for a column to count as numeric. */
const NUMERIC_THRESHOLD = 0.8;

export function isMissingToken(raw: string): boolean {
  return MISSING_TOKENS.has(raw.trim().toLowerCase());
}

/**
 * Strict number parser. Accepts "1", "-2.5", "+.5", "6.02e23", and the
 * Unicode minus sign "−" that sneaks in from word processors. Returns NaN
 * for anything else, including "" (where Number("") would give 0).
 */
export function parseNumber(raw: string): number {
  const s = raw.trim().replace(/^−/, "-").replace(/e−/i, "e-");
  if (!NUMBER_PATTERN.test(s)) return NaN;
  return Number(s);
}

export interface ParsedTable {
  headers: string[];
  /** Data rows, each normalised to `headers.length` cells. */
  rows: string[][];
  hasHeader: boolean;
  delimiter: string;
  warnings: string[];
}

export type ParseOutcome = { ok: true; table: ParsedTable } | { ok: false; error: string };

function isNumericCell(cell: string | undefined): boolean {
  return cell !== undefined && Number.isFinite(parseNumber(cell));
}

/**
 * Decide whether the first row is a header.
 *  - All non-empty cells are text → header.
 *  - Some cell is text while the cells below it are (mostly) numbers → header.
 *  - Otherwise the first row is data.
 */
export function detectHeader(rows: string[][]): boolean {
  if (rows.length === 0) return false;
  const first = rows[0];
  const nonEmpty = first.filter((c) => !isMissingToken(c));
  if (nonEmpty.length === 0) return false;
  if (nonEmpty.every((c) => !isNumericCell(c))) return true;
  const sample = rows.slice(1, 51);
  for (let j = 0; j < first.length; j++) {
    if (isMissingToken(first[j]) || isNumericCell(first[j])) continue;
    const below = sample.map((r) => r[j]).filter((c): c is string => c !== undefined && !isMissingToken(c));
    if (below.length > 0 && below.filter((c) => isNumericCell(c)).length / below.length >= NUMERIC_THRESHOLD) {
      return true;
    }
  }
  return false;
}

/** Most common row length (ties broken towards the longer length). */
function modalLength(rows: string[][]): number {
  const counts = new Map<number, number>();
  for (const r of rows) counts.set(r.length, (counts.get(r.length) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [len, count] of counts) {
    if (count > bestCount || (count === bestCount && len > best)) {
      best = len;
      bestCount = count;
    }
  }
  return best;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** Tokenise delimited text and normalise it into a rectangular table. */
export function parseDelimitedText(input: string): ParseOutcome {
  const text = input.replace(/^﻿/, ""); // byte-order mark from Excel
  if (text.trim() === "") return { ok: false, error: "The file is empty." };

  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    comments: "#",
    delimitersToGuess: [",", "\t", ";", "|"],
  });

  const warnings: string[] = [];
  const quoteErrors = parsed.errors.filter((e) => e.type === "Quotes");
  if (quoteErrors.length > 0) {
    warnings.push(
      `${plural(quoteErrors.length, "row")} had unbalanced quotes (first at row ${(quoteErrors[0].row ?? 0) + 1}); check those values.`,
    );
  }

  const rawRows = parsed.data.map((r) => r.map((c) => (c ?? "").trim()));
  if (rawRows.length === 0) return { ok: false, error: "No rows were found in the file." };

  const hasHeader = detectHeader(rawRows);
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows;
  if (dataRows.length === 0) return { ok: false, error: "The file has a header row but no data rows." };

  let width = hasHeader ? rawRows[0].length : modalLength(dataRows);
  // Drop trailing empty header cells (e.g. "a,b,,") that carry no data.
  if (hasHeader) {
    while (
      width > 1 &&
      rawRows[0][width - 1] === "" &&
      dataRows.every((r) => r[width - 1] === undefined || r[width - 1] === "")
    ) {
      width--;
    }
  }

  let shortRows = 0;
  let longRows = 0;
  const rows = dataRows.map((r) => {
    if (r.length < width) {
      shortRows++;
      return [...r, ...new Array<string>(width - r.length).fill("")];
    }
    if (r.length > width) {
      const extra = r.slice(width);
      if (extra.some((c) => c !== "")) longRows++;
      return r.slice(0, width);
    }
    return r;
  });
  if (shortRows > 0) {
    warnings.push(`${plural(shortRows, "row")} had too few fields; the missing cells were left blank.`);
  }
  if (longRows > 0) {
    warnings.push(`${plural(longRows, "row")} had more fields than the header; the extra fields were ignored.`);
  }

  const headerCells = hasHeader ? rawRows[0].slice(0, width) : [];
  const headers = Array.from({ length: width }, (_, j) => headerCells[j] || `Column ${j + 1}`);

  return {
    ok: true,
    table: {
      headers,
      rows,
      hasHeader,
      delimiter: parsed.meta.delimiter,
      warnings,
    },
  };
}

/** Convert a parsed table into typed dataset columns. */
export function tableToColumns(table: ParsedTable): { columns: DataColumn[]; warnings: string[] } {
  const warnings: string[] = [];
  const columns: DataColumn[] = [];
  const usedNames = new Set<string>();

  table.headers.forEach((header, j) => {
    const cells = table.rows.map((r) => r[j] ?? "");
    const parsedHeader = parseHeaderUnit(header);
    const name = parsedHeader.name || `Column ${j + 1}`;
    const unit = parsedHeader.unit;
    let unique = name;
    for (let k = 2; usedNames.has(unique); k++) unique = `${name} (${k})`;
    usedNames.add(unique);

    let nonEmpty = 0;
    let numeric = 0;
    const values = cells.map((c) => {
      if (isMissingToken(c)) return NaN;
      nonEmpty++;
      const v = parseNumber(c);
      if (Number.isFinite(v)) numeric++;
      return v;
    });

    const isNumeric = numeric > 0 && numeric / nonEmpty >= NUMERIC_THRESHOLD;
    if (isNumeric && numeric < nonEmpty) {
      warnings.push(
        `Column "${unique}": ${plural(nonEmpty - numeric, "non-numeric value")} treated as missing.`,
      );
    }

    columns.push({
      id: createId("col"),
      name: unique,
      symbol: makeSymbol(unique, columns.map((c) => c.symbol)),
      unit,
      kind: isNumeric ? "numeric" : "text",
      values: isNumeric ? values : cells.map(() => NaN),
      text: isNumeric ? undefined : cells,
      origin: { type: "imported" },
      uncertainty: null,
    });
  });

  if (!columns.some((c) => c.kind === "numeric")) {
    warnings.push("No numeric columns were found, so nothing can be plotted.");
  }
  return { columns, warnings };
}

export type ImportOutcome =
  | { ok: true; dataset: Dataset; hasHeader: boolean; delimiter: string }
  | { ok: false; error: string };

/** Parse delimited text into a ready-to-use dataset. */
export function importDelimitedText(text: string, name: string, source: DatasetSource): ImportOutcome {
  const parsed = parseDelimitedText(text);
  if (!parsed.ok) return parsed;
  const { columns, warnings } = tableToColumns(parsed.table);
  if (!columns.some((c) => c.kind === "numeric")) {
    return {
      ok: false,
      error: "No numeric columns were found. OpenLab needs at least one column of numbers (use a decimal point, e.g. 0.25).",
    };
  }
  const dataset = createDataset({
    name,
    source,
    columns,
    rowCount: parsed.table.rows.length,
    importWarnings: [...parsed.table.warnings, ...warnings],
  });
  return { ok: true, dataset, hasHeader: parsed.table.hasHeader, delimiter: parsed.table.delimiter };
}
