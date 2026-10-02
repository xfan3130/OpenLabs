"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { parseNumber } from "@/lib/csv";

function toText(value: number | null): string {
  return value === null ? "" : String(value);
}

/**
 * Numeric text input that accepts scientific notation ("2.5e-3") and keeps
 * partially typed text ("-", "1e") without fighting the user. Valid values
 * are committed on every keystroke so the graph updates immediately; an
 * empty field commits null.
 */
export function NumberField({
  value: rawValue,
  onChange,
  placeholder,
  id,
  ariaLabel,
  className,
  min,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
  /** Reject values below this bound (e.g. 0 for uncertainties). */
  min?: number;
}) {
  // Treat NaN like an empty field so the sync check below cannot loop (NaN !== NaN).
  const value = rawValue !== null && Number.isFinite(rawValue) ? rawValue : null;
  const [draft, setDraft] = useState(toText(value));
  const [lastValue, setLastValue] = useState(value);
  const [invalid, setInvalid] = useState(false);

  // Adopt external changes (e.g. switching datasets) without an effect.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumber(draft) !== value) {
      setDraft(toText(value));
      setInvalid(false);
    }
  }

  return (
    <Input
      id={id}
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      className={className}
      value={draft}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        if (text.trim() === "") {
          setInvalid(false);
          setLastValue(null);
          onChange(null);
          return;
        }
        const v = parseNumber(text);
        const ok = Number.isFinite(v) && (min === undefined || v >= min);
        setInvalid(!ok);
        if (ok) {
          setLastValue(v);
          onChange(v);
        }
      }}
    />
  );
}
