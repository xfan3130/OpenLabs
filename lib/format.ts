import { toSuperscript } from "./units";

/**
 * Number formatting for scientific display.
 *
 * Values are shown with a fixed number of significant figures. Very large or
 * very small magnitudes switch to scientific notation written with a real
 * "× 10ⁿ" so that text copied out of OpenLab reads correctly in a lab report.
 */

const SCI_LOW_EXPONENT = -3; // below 0.001 → scientific
const SCI_HIGH_EXPONENT = 6; // 1 000 000 and above → scientific

/** Placeholder for undefined values. */
export const MISSING = "—";

/** Decimal exponent of |v| after rounding to `sig` significant figures. */
function exponentOf(v: number, sig: number): number {
  const rounded = Number(Math.abs(v).toPrecision(sig));
  return Math.floor(Math.log10(rounded));
}

function scientific(mantissa: string, exponent: number): string {
  return `${mantissa} × 10${toSuperscript(String(exponent))}`;
}

/** Use the Unicode minus sign (U+2212) for nicer typography. */
function withMinus(text: string): string {
  return text.replace(/^-/, "−");
}

/**
 * Format with `sig` significant figures (default 4).
 *   formatNumber(9.80665)     → "9.807"
 *   formatNumber(0.000012346) → "1.235 × 10⁻⁵"
 *   formatNumber(NaN)         → "—"
 */
export function formatNumber(value: number, sig = 4): string {
  if (Number.isNaN(value)) return MISSING;
  if (value === Infinity) return "∞";
  if (value === -Infinity) return "−∞";
  if (value === 0) return "0";
  const exponent = exponentOf(value, sig);
  if (exponent < SCI_LOW_EXPONENT || exponent >= SCI_HIGH_EXPONENT) {
    const [mantissa, exp] = value.toExponential(sig - 1).split("e");
    return withMinus(scientific(mantissa, Number(exp)));
  }
  const decimals = Math.max(0, sig - 1 - exponent);
  return withMinus(value.toFixed(decimals));
}

/**
 * Plain ASCII number with up to `sig` significant figures and no trailing
 * zeros, for CSV / machine-readable output. NaN → "".
 */
export function formatPlain(value: number, sig = 12): string {
  if (!Number.isFinite(value)) return "";
  return String(Number(value.toPrecision(sig)));
}

/**
 * Number of significant figures to keep in an uncertainty: 2 when its
 * leading digit is 1 or 2 (rounding 0.14 to 0.1 would change it by 30 %),
 * otherwise 1. This is the convention taught in most introductory labs.
 */
export function uncertaintySigFigs(uncertainty: number): number {
  const leading = Number(Math.abs(uncertainty).toExponential(0).charAt(0));
  return leading === 1 || leading === 2 ? 2 : 1;
}

/**
 * Format a value with its uncertainty, rounding the uncertainty to 1–2
 * significant figures and the value to the same decimal place:
 *   (4.8213, 0.0532)   → "4.82 ± 0.05"
 *   (9.8123, 0.0147)   → "9.812 ± 0.015"
 *   (1.234e-7, 3.1e-9) → "(1.23 ± 0.03) × 10⁻⁷"
 * Falls back to formatNumber(value) when the uncertainty is missing or ≤ 0.
 */
export function formatWithUncertainty(value: number, uncertainty: number): string {
  if (!Number.isFinite(value)) return formatNumber(value);
  if (!Number.isFinite(uncertainty) || uncertainty <= 0) return formatNumber(value);

  const sf = uncertaintySigFigs(uncertainty);
  const uExp = Math.floor(Math.log10(Number(uncertainty.toPrecision(sf))));
  // Decimal position of the last significant digit of the uncertainty.
  const place = uExp - (sf - 1);
  const scale = Math.pow(10, place);
  const u = Math.round(uncertainty / scale) * scale;
  const v = Math.round(value / scale) * scale;

  const vExp = v === 0 ? uExp : Math.floor(Math.log10(Math.abs(v)));
  const leadExp = Math.max(vExp, uExp);
  if (leadExp >= SCI_LOW_EXPONENT && leadExp < SCI_HIGH_EXPONENT && place >= -8) {
    const decimals = Math.max(0, -place);
    return `${withMinus(v.toFixed(decimals))} ± ${u.toFixed(decimals)}`;
  }

  // Scientific notation with a shared exponent.
  const decimals = Math.max(0, leadExp - place);
  const factor = Math.pow(10, leadExp);
  const vm = withMinus((v / factor).toFixed(decimals));
  const um = (u / factor).toFixed(decimals);
  return `(${vm} ± ${um}) × 10${toSuperscript(String(leadExp))}`;
}

/** Percentage with sensible precision: 0.0123 % → "0.012 %", 12.345 → "12 %". */
export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return MISSING;
  const abs = Math.abs(percent);
  const sig = abs >= 10 ? 3 : 2;
  return `${formatNumber(percent, sig)} %`;
}

/** Append a unit with a thin space, skipping it for undefined values. */
export function withUnit(text: string, unit: string): string {
  if (!unit || text === MISSING) return text;
  return `${text} ${unit}`;
}
