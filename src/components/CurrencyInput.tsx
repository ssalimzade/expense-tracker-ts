import { useRef, useState } from "react";

interface Props {
  value: number | null;
  /** Fired on every keystroke with the parsed number (for live recalculation). */
  onLiveChange?: (n: number) => void;
  /** Fired on blur / Enter with the final value. */
  onCommit: (n: number | null) => void;
  allowEmpty?: boolean;
  /** Force the stored value negative (repayments). Display is always positive. */
  forceNegative?: boolean;
  className?: string;
  placeholder?: string;
}

/**
 * Text input that shows a glued "£200" at rest and a raw editable number on focus.
 * The £ sits immediately before the digits, right-aligned, so it never drifts.
 */
export default function CurrencyInput({
  value,
  onLiveChange,
  onCommit,
  allowEmpty = false,
  forceNegative = false,
  className = "",
  placeholder = "—",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  // Only commit when actually typed into, so clicking in/out doesn't re-save.
  const touched = useRef(false);
  // Capture value at focus time; onLiveChange mutates the prop before blur fires.
  const valueAtFocus = useRef<number | null>(null);

  const display =
    value === null || value === undefined
      ? ""
      : `£${Math.abs(value).toLocaleString("en-GB", { maximumFractionDigits: 2 })}`;

  const parse = (s: string): number | null => {
    const cleaned = s.replace(/[^0-9.]/g, "");
    if (cleaned === "") return allowEmpty ? null : 0;
    const n = parseFloat(cleaned);
    if (!Number.isFinite(n)) return allowEmpty ? null : 0;
    return forceNegative ? -Math.abs(n) : n;
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={editing ? raw : display}
      placeholder={editing ? "" : placeholder}
      onFocus={(e) => {
        setEditing(true);
        touched.current = false;
        valueAtFocus.current = value ?? null;
        setRaw(value === null || value === undefined ? "" : String(Math.abs(value)));
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => {
        touched.current = true;
        setRaw(e.target.value);
        const n = parse(e.target.value);
        if (onLiveChange && n !== null) onLiveChange(n);
      }}
      onBlur={() => {
        setEditing(false);
        if (!touched.current) return;
        const n = parse(raw);
        if (n !== valueAtFocus.current) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}
