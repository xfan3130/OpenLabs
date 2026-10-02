import { all, create, type MathNode } from "mathjs";
import type { DataColumn } from "@/types/dataset";
import { ALLOWED_CONSTANTS, ALLOWED_FUNCTIONS } from "./expressionNames";

/**
 * Calculated columns.
 *
 * Expressions are parsed with math.js (never JavaScript eval) and then
 * checked against an allow-list before anything is evaluated: only
 * arithmetic operators, numeric literals, the dataset's column symbols, a
 * curated set of functions and a few constants are accepted. Assignments,
 * unit conversions, strings, matrices, and every other math.js feature are
 * rejected with a clear message.
 */

// `predictable: true` makes sqrt(-1) and log(-1) return NaN instead of a
// complex number, so invalid rows are detected uniformly.
const math = create(all, { number: "number", predictable: true });

const FUNCTION_SET = new Set<string>(ALLOWED_FUNCTIONS);
const CONSTANT_SET = new Set<string>(ALLOWED_CONSTANTS);

const ALLOWED_OPERATORS = new Set([
  "add",
  "subtract",
  "multiply",
  "divide",
  "pow",
  "unaryMinus",
  "unaryPlus",
  "mod",
  "dotMultiply",
  "dotDivide",
  "dotPow",
]);

/** Functions math.js does not provide under these names. */
const EXTRA_FUNCTIONS: Record<string, (x: number) => number> = {
  ln: (x) => Math.log(x),
  deg: (x) => (x * 180) / Math.PI,
  rad: (x) => (x * Math.PI) / 180,
};

export type ExpressionCheck =
  | { ok: true; symbols: string[] }
  | { ok: false; error: string };

function describeNode(node: MathNode): string {
  switch (node.type) {
    case "AssignmentNode":
    case "FunctionAssignmentNode":
      return "Assignments (=) are not allowed. Write only the formula, e.g. position / time.";
    case "ArrayNode":
    case "IndexNode":
    case "AccessorNode":
    case "RangeNode":
      return "Arrays, ranges and indexing are not supported. Refer to columns by name; the formula is applied row by row.";
    case "BlockNode":
      return "Only a single expression is allowed (no ; or line breaks).";
    case "ObjectNode":
      return "Objects are not supported in expressions.";
    case "RelationalNode":
    case "ConditionalNode":
      return "Comparisons and conditionals are not supported.";
    default:
      return `Unsupported syntax: ${node.type}.`;
  }
}

function availableList(columnSymbols: readonly string[]): string {
  return columnSymbols.length ? columnSymbols.join(", ") : "(none)";
}

function parse(expression: string): { ok: true; node: MathNode } | { ok: false; error: string } {
  if (expression.trim() === "") return { ok: false, error: "Enter an expression." };
  try {
    return { ok: true, node: math.parse(expression) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Syntax error: ${message}` };
  }
}

/**
 * Validate an expression against the allow-list without evaluating it on
 * real data. Returns the column symbols it references.
 */
export function checkExpression(expression: string, columnSymbols: readonly string[]): ExpressionCheck {
  const parsed = parse(expression);
  if (!parsed.ok) return parsed;

  const columns = new Set(columnSymbols);
  const used = new Set<string>();
  let error: string | null = null;

  parsed.node.traverse((node, path, parent) => {
    if (error) return;
    switch (node.type) {
      case "ParenthesisNode":
        return;
      case "ConstantNode": {
        const value = (node as unknown as { value: unknown }).value;
        if (typeof value !== "number") error = "Only numeric constants are allowed (no text in quotes).";
        return;
      }
      case "OperatorNode": {
        const op = node as unknown as { fn: string; op: string };
        if (!ALLOWED_OPERATORS.has(op.fn)) error = `The operator "${op.op}" is not supported.`;
        return;
      }
      case "FunctionNode": {
        const fn = (node as unknown as { fn: MathNode }).fn;
        const name = fn.type === "SymbolNode" ? (fn as unknown as { name: string }).name : null;
        if (!name || !FUNCTION_SET.has(name)) {
          error = `Unknown function "${name ?? "?"}". Available functions: ${ALLOWED_FUNCTIONS.join(", ")}.`;
        }
        return;
      }
      case "SymbolNode": {
        // Function names are checked by their FunctionNode parent.
        if (parent?.type === "FunctionNode" && path === "fn") return;
        const name = (node as unknown as { name: string }).name;
        if (columns.has(name)) {
          used.add(name);
          return;
        }
        if (CONSTANT_SET.has(name)) return;
        if (FUNCTION_SET.has(name)) {
          error = `"${name}" is a function; call it with parentheses, e.g. ${name}(x).`;
          return;
        }
        const caseMatch = columnSymbols.find((s) => s.toLowerCase() === name.toLowerCase());
        error = caseMatch
          ? `Unknown variable "${name}". Did you mean "${caseMatch}"? (Names are case-sensitive.)`
          : `Unknown variable "${name}". Available columns: ${availableList(columnSymbols)}.`;
        return;
      }
      default:
        error = describeNode(node);
    }
  });

  if (error) return { ok: false, error };
  return { ok: true, symbols: [...used] };
}

export type EvaluationOutcome =
  | { ok: true; values: number[]; invalidCount: number }
  | { ok: false; error: string };

/**
 * Evaluate an expression row by row over the dataset's numeric columns.
 *
 * Rows where a referenced value is missing produce a missing result. Rows
 * whose result is not a finite real number (division by zero, log of a
 * negative number, …) are also left missing and counted in `invalidCount`.
 */
export function evaluateExpression(
  expression: string,
  columns: readonly DataColumn[],
  rowCount: number,
): EvaluationOutcome {
  const numeric = columns.filter((c) => c.kind === "numeric");
  const check = checkExpression(
    expression,
    numeric.map((c) => c.symbol),
  );
  if (!check.ok) return check;

  const compiled = math.parse(expression).compile();
  const used = numeric.filter((c) => check.symbols.includes(c.symbol));
  const scope: Record<string, unknown> = { ...EXTRA_FUNCTIONS };

  // Dry run with placeholder values to surface errors such as a wrong
  // number of function arguments before touching the data.
  try {
    for (const c of used) scope[c.symbol] = 1.5;
    compiled.evaluate(scope);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  const values = new Array<number>(rowCount).fill(NaN);
  let invalidCount = 0;
  for (let i = 0; i < rowCount; i++) {
    let missing = false;
    for (const c of used) {
      const v = c.values[i];
      if (!Number.isFinite(v)) {
        missing = true;
        break;
      }
      scope[c.symbol] = v;
    }
    if (missing) continue;
    let result: unknown;
    try {
      result = compiled.evaluate(scope);
    } catch {
      invalidCount++;
      continue;
    }
    if (typeof result === "number" && Number.isFinite(result)) {
      values[i] = result;
    } else {
      invalidCount++;
    }
  }
  return { ok: true, values, invalidCount };
}
