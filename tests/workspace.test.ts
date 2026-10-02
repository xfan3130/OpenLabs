import { describe, expect, it } from "vitest";
import { importDelimitedText } from "@/lib/csv";
import { createNumericColumn } from "@/lib/dataset";
import {
  deserializeWorkspace,
  EMPTY_WORKSPACE,
  serializeWorkspace,
  workspaceReducer,
  type WorkspaceState,
} from "@/hooks/useWorkspace";
import { datasetCsv } from "@/lib/report";
import { fitModel } from "@/lib/regression";

function load(text: string): WorkspaceState {
  const out = importDelimitedText(text, "Run", "paste");
  if (!out.ok) throw new Error(out.error);
  return workspaceReducer(EMPTY_WORKSPACE, { type: "addDataset", dataset: out.dataset });
}

describe("workspace reducer", () => {
  it("adds a dataset and makes it active", () => {
    const s = load("t,x\n0,1\n1,2\n");
    expect(s.datasets).toHaveLength(1);
    expect(s.activeId).toBe(s.datasets[0].id);
  });

  it("removing a plotted column clears it from the analysis", () => {
    let s = load("t,x,v\n0,1,5\n1,2,6\n");
    const d = s.datasets[0];
    const v = d.columns[2];
    s = workspaceReducer(s, {
      type: "updateAnalysis",
      id: d.id,
      update: (a) => ({ ...a, yColumnIds: [v.id], fit: { ...a.fit, targetColumnId: v.id } }),
    });
    s = workspaceReducer(s, { type: "removeColumn", id: d.id, columnId: v.id });
    const a = s.datasets[0].analysis;
    expect(s.datasets[0].columns).toHaveLength(2);
    expect(a.yColumnIds).toEqual([]);
    expect(a.fit.targetColumnId).toBeNull();
  });

  it("removing the active dataset activates another", () => {
    let s = load("t,x\n0,1\n1,2\n");
    const first = s.datasets[0].id;
    const out = importDelimitedText("a,b\n1,2\n3,4\n", "Second", "paste");
    if (!out.ok) throw new Error(out.error);
    s = workspaceReducer(s, { type: "addDataset", dataset: out.dataset });
    s = workspaceReducer(s, { type: "removeDataset", id: out.dataset.id });
    expect(s.activeId).toBe(first);
    expect(workspaceReducer(s, { type: "reset" })).toEqual(EMPTY_WORKSPACE);
  });
});

describe("workspace persistence", () => {
  it("round-trips missing values (NaN) through JSON", () => {
    const s = load("t,x\n0,1\n1,\n2,3\n");
    const restored = deserializeWorkspace(serializeWorkspace(s));
    expect(restored).not.toBeNull();
    const x = restored!.datasets[0].columns[1].values;
    expect(x[0]).toBe(1);
    expect(x[1]).toBeNaN();
    expect(restored!.activeId).toBe(s.activeId);
  });

  it("rejects malformed saved data", () => {
    expect(deserializeWorkspace(JSON.stringify({ datasets: [{ id: 1 }] }))).toBeNull();
    expect(deserializeWorkspace(JSON.stringify({}))).toBeNull();
  });
});

describe("dataset CSV export", () => {
  it("writes units, uncertainties, fitted values and residuals", () => {
    const s = load("time (s),position (m)\n0,0.1\n1,2.1\n2,3.9\n3,6.1\n");
    const d = s.datasets[0];
    const [t, x] = d.columns;
    const withUnc = { ...d, columns: [t, { ...x, uncertainty: { kind: "absolute" as const, value: 0.05 } }] };
    const fit = fitModel("linear", t.values, x.values);
    if (!fit.ok) throw new Error(fit.error);
    const csv = datasetCsv(withUnc, { result: fit.result, y: x });
    const [header, first] = csv.trim().split(/\r?\n/);
    expect(header).toBe("time (s),position (m),position uncertainty (m),position fit (m),position residual (m)");
    const cells = first.split(",").map(Number);
    expect(cells[2]).toBe(0.05);
    expect(cells[3] + cells[4]).toBeCloseTo(0.1, 10); // fit + residual = observed
  });

  it("keeps derived columns", () => {
    const s = load("t,x\n0,1\n1,3\n");
    const d = s.datasets[0];
    const col = createNumericColumn(d.columns, { name: "double", values: [2, 6], origin: { type: "expression", expression: "2*x" } });
    const csv = datasetCsv({ ...d, columns: [...d.columns, col] }, null);
    expect(csv.split(/\r?\n/)[0]).toBe("t,x,double");
  });
});
