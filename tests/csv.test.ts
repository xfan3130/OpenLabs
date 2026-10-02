import { describe, expect, it } from "vitest";
import { detectHeader, importDelimitedText, parseDelimitedText, parseNumber } from "@/lib/csv";

describe("parseNumber", () => {
  it("parses ordinary and scientific notation", () => {
    expect(parseNumber("0.25")).toBe(0.25);
    expect(parseNumber(" -3 ")).toBe(-3);
    expect(parseNumber("+.5")).toBe(0.5);
    expect(parseNumber("6.02e23")).toBe(6.02e23);
    expect(parseNumber("1E-3")).toBe(0.001);
  });

  it("accepts the Unicode minus sign", () => {
    expect(parseNumber("−4.5")).toBe(-4.5);
    expect(parseNumber("2e−3")).toBe(0.002);
  });

  it("rejects text and empty cells instead of returning 0", () => {
    expect(parseNumber("")).toBeNaN();
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("1.2.3")).toBeNaN();
    expect(parseNumber("12 m")).toBeNaN();
  });
});

describe("detectHeader", () => {
  it("detects a text header above numeric data", () => {
    expect(detectHeader([["time", "position"], ["0", "0"], ["0.1", "0.06"]])).toBe(true);
  });

  it("treats an all-numeric first row as data", () => {
    expect(detectHeader([["0", "0"], ["0.1", "0.06"]])).toBe(false);
  });

  it("does not mistake a text data column for a header", () => {
    expect(detectHeader([["A", "1"], ["B", "2"], ["C", "3"]])).toBe(false);
  });
});

describe("parseDelimitedText", () => {
  it("parses the documented example", () => {
    const out = parseDelimitedText("time,position\n0,0\n0.1,0.06\n0.2,0.21\n0.3,0.45\n0.4,0.82\n");
    if (!out.ok) throw new Error(out.error);
    expect(out.table.hasHeader).toBe(true);
    expect(out.table.headers).toEqual(["time", "position"]);
    expect(out.table.rows).toHaveLength(5);
    expect(out.table.warnings).toEqual([]);
  });

  it("detects tab and semicolon delimiters", () => {
    const tab = parseDelimitedText("t\tx\n0\t1\n1\t2\n");
    const semi = parseDelimitedText("t;x\n0;1\n1;2\n");
    expect(tab.ok && tab.table.delimiter).toBe("\t");
    expect(semi.ok && semi.table.delimiter).toBe(";");
  });

  it("generates column names when there is no header", () => {
    const out = parseDelimitedText("0,1\n1,2\n2,4\n");
    if (!out.ok) throw new Error(out.error);
    expect(out.table.hasHeader).toBe(false);
    expect(out.table.headers).toEqual(["Column 1", "Column 2"]);
    expect(out.table.rows).toHaveLength(3);
  });

  it("repairs short and long rows and warns about them", () => {
    const out = parseDelimitedText("a,b,c\n1,2,3\n4,5\n6,7,8,9\n");
    if (!out.ok) throw new Error(out.error);
    expect(out.table.rows[1]).toEqual(["4", "5", ""]);
    expect(out.table.rows[2]).toEqual(["6", "7", "8"]);
    expect(out.table.warnings.join(" ")).toMatch(/too few fields/);
    expect(out.table.warnings.join(" ")).toMatch(/more fields/);
  });

  it("strips a byte-order mark, skips blank lines and # comments", () => {
    const out = parseDelimitedText("﻿# recorded 2024-03-01\ntime,x\n\n0,1\n\n1,2\n");
    if (!out.ok) throw new Error(out.error);
    expect(out.table.headers).toEqual(["time", "x"]);
    expect(out.table.rows).toHaveLength(2);
  });

  it("drops trailing empty columns from spreadsheet exports", () => {
    const out = parseDelimitedText("t,x,,\n0,1,,\n1,2,,\n");
    if (!out.ok) throw new Error(out.error);
    expect(out.table.headers).toEqual(["t", "x"]);
  });

  it("reports empty input and header-only files", () => {
    expect(parseDelimitedText("").ok).toBe(false);
    expect(parseDelimitedText("   \n ").ok).toBe(false);
    expect(parseDelimitedText("time,position\n").ok).toBe(false);
  });
});

describe("importDelimitedText", () => {
  it("builds numeric columns, extracts units, and picks default axes", () => {
    const out = importDelimitedText("time (s),position [m]\n0,0\n0.1,0.06\n0.2,0.21\n", "Run 1", "file");
    if (!out.ok) throw new Error(out.error);
    const [t, x] = out.dataset.columns;
    expect(t.name).toBe("time");
    expect(t.unit).toBe("s");
    expect(t.symbol).toBe("time");
    expect(x.name).toBe("position");
    expect(x.unit).toBe("m");
    expect(x.values).toEqual([0, 0.06, 0.21]);
    expect(out.dataset.rowCount).toBe(3);
    expect(out.dataset.analysis.xColumnId).toBe(t.id);
    expect(out.dataset.analysis.yColumnIds).toEqual([x.id]);
  });

  it("treats stray non-numeric cells as missing and warns", () => {
    const out = importDelimitedText("t,x\n0,1\n1,oops\n2,3\n3,4\n4,5\n", "d", "paste");
    if (!out.ok) throw new Error(out.error);
    const x = out.dataset.columns[1];
    expect(x.kind).toBe("numeric");
    expect(x.values[1]).toBeNaN();
    expect(out.dataset.importWarnings.join(" ")).toMatch(/1 non-numeric value/);
  });

  it("treats NA and blank cells as missing without warning", () => {
    const out = importDelimitedText("t,x\n0,1\n1,NA\n2,\n", "d", "paste");
    if (!out.ok) throw new Error(out.error);
    expect(out.dataset.columns[1].values.slice(1).every(Number.isNaN)).toBe(true);
    expect(out.dataset.importWarnings).toEqual([]);
  });

  it("keeps text columns for display but not for plotting", () => {
    const out = importDelimitedText("group,t,x\nA,0,1\nB,1,2\nC,2,3\n", "d", "file");
    if (!out.ok) throw new Error(out.error);
    const group = out.dataset.columns[0];
    expect(group.kind).toBe("text");
    expect(group.text).toEqual(["A", "B", "C"]);
    expect(out.dataset.analysis.xColumnId).toBe(out.dataset.columns[1].id);
  });

  it("makes duplicate names and symbols unique", () => {
    const out = importDelimitedText("x,x,2nd trial\n1,2,3\n4,5,6\n", "d", "file");
    if (!out.ok) throw new Error(out.error);
    const names = out.dataset.columns.map((c) => c.name);
    const symbols = out.dataset.columns.map((c) => c.symbol);
    expect(names).toEqual(["x", "x (2)", "2nd trial"]);
    expect(new Set(symbols).size).toBe(3);
    expect(symbols[2]).toBe("c_2nd_trial");
  });

  it("fails clearly when no column is numeric", () => {
    const out = importDelimitedText("name,colour\nA,red\nB,blue\n", "d", "file");
    expect(out.ok).toBe(false);
  });
});
