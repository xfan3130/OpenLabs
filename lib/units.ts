/**
 * Lightweight unit-string handling. OpenLab does not do dimensional
 * analysis yet (see the roadmap); units are display strings that are
 * combined symbolically for derived quantities such as slopes.
 */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  "0": "⁰",
  "1": "¹",
  "2": "²",
  "3": "³",
  "4": "⁴",
  "5": "⁵",
  "6": "⁶",
  "7": "⁷",
  "8": "⁸",
  "9": "⁹",
  "-": "⁻",
  "−": "⁻",
  "+": "⁺",
  ".": "·",
};

/** "−12" → "⁻¹²". Characters without a superscript form are kept as-is. */
export function toSuperscript(text: string): string {
  return Array.from(text)
    .map((ch) => SUPERSCRIPT_DIGITS[ch] ?? ch)
    .join("");
}

/**
 * Split a column header into name and unit:
 *   "time (s)"       → { name: "time", unit: "s" }
 *   "Position [m]"   → { name: "Position", unit: "m" }
 *   "velocity"       → { name: "velocity", unit: "" }
 */
export function parseHeaderUnit(header: string): { name: string; unit: string } {
  const trimmed = header.trim();
  const match = /^(.*\S)\s*[([]\s*([^()[\]]*?)\s*[)\]]$/.exec(trimmed);
  if (match && match[2].length > 0) {
    return { name: match[1].trim(), unit: match[2] };
  }
  return { name: trimmed, unit: "" };
}

function needsParens(unit: string): boolean {
  return /[\s/·*]/.test(unit);
}

/** u raised to an integer power, e.g. ("s", 2) → "s²". */
export function powerUnit(unit: string, power: number): string {
  if (!unit || power === 0) return "";
  if (power === 1) return unit;
  const base = needsParens(unit) ? `(${unit})` : unit;
  return `${base}${toSuperscript(String(power))}`;
}

/**
 * Unit of a quotient numerator / denominatorᵖ, e.g.
 *   ("m", "s", 1) → "m/s",  ("m", "s", 2) → "m/s²",  ("", "s", 1) → "1/s".
 * Returns "" when both units are unknown.
 */
export function quotientUnit(numerator: string, denominator: string, power = 1): string {
  const num = numerator.trim();
  const den = powerUnit(denominator.trim(), power);
  if (!den) return num;
  if (num && num === denominator.trim() && power === 1) return "";
  const top = num ? (num.includes("/") ? `(${num})` : num) : "1";
  const bottom = needsParens(den) && !/^\(.*\)\S*$/.test(den) ? `(${den})` : den;
  return `${top}/${bottom}`;
}

/** "Position" + "m" → "Position (m)". */
export function labelWithUnit(label: string, unit: string): string {
  return unit ? `${label} (${unit})` : label;
}
