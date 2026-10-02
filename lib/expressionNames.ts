/**
 * Names available inside calculated-column expressions. Kept separate from
 * `expressions.ts` (which pulls in math.js) so that dataset helpers can
 * avoid generating column symbols that collide with them.
 */

/** Functions students can use in expressions. Everything else is rejected. */
export const ALLOWED_FUNCTIONS = [
  "abs",
  "sqrt",
  "cbrt",
  "exp",
  "ln",
  "log",
  "log10",
  "log2",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
  "atan2",
  "sinh",
  "cosh",
  "tanh",
  "sec",
  "csc",
  "cot",
  "deg",
  "rad",
  "pow",
  "min",
  "max",
  "mod",
  "round",
  "floor",
  "ceil",
  "sign",
  "hypot",
] as const;

/** Mathematical constants available in expressions. */
export const ALLOWED_CONSTANTS = ["pi", "e", "tau", "phi"] as const;

/** Words that cannot be used as column symbols. */
export const RESERVED_SYMBOLS = new Set<string>([
  ...ALLOWED_FUNCTIONS,
  ...ALLOWED_CONSTANTS,
  "PI",
  "E",
  "i",
  "true",
  "false",
  "null",
  "undefined",
  "Infinity",
  "NaN",
  "to",
  "in",
  "and",
  "or",
  "not",
  "xor",
  "end",
]);
