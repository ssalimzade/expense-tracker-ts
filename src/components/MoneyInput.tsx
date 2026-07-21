import { useRef, useState } from "react";

interface Props {
  value: number;
  onCommit: (n: number) => void;
  color?: string;
  /** Allow negative values (e.g. adjustments / other P&L). */
  allowNegative?: boolean;
  /** Show a "£" prefix at rest. On by default — table amounts always show £. */
  pound?: boolean;
  /** Render as read-only derived text (not an input). */
  readOnly?: boolean;
  className?: string;
}

/**
 * Inline number input: shows a comma-formatted whole-pound value at rest, raw on
 * focus. Commits on blur / Enter, restores on Escape. Shared across the editable
 * tables — all of which display whole pounds (no decimals).
 */
export default function MoneyInput({
  value,
  onCommit,
  color,
  allowNegative = false,
  pound = true,
  readOnly = false,
  className = "",
}: Props) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  // Only commit when the field was actually typed into — clicking in and out
  // (which can re-round a decimal value) must not trigger a save.
  const touched = useRef(false);

  // All editable amounts display as whole pounds (no decimals) everywhere.
  const rounded = Math.round(value);
  const fmt = `${pound ? "£" : ""}${rounded.toLocaleString("en-GB")}`;

  if (readOnly) {
    return (
      <span
        style={color ? { color } : undefined}
        className={`inline-block w-20 px-2 py-1 text-center text-sm tabular-nums ${color ? "font-semibold" : ""} ${className}`}
      >
        {fmt}
      </span>
    );
  }

  return (
    <input
      type="text"
      // Negative-capable fields need the full keyboard: the mobile "decimal"
      // keypad has no minus key, so "-" can't be typed there.
      inputMode={allowNegative ? "text" : "decimal"}
      value={editing ? raw : fmt}
      style={color ? { color } : undefined}
      onFocus={() => {
        setEditing(true);
        touched.current = false;
        setRaw(value === 0 ? "" : String(rounded));
      }}
      onChange={(e) => {
        touched.current = true;
        setRaw(e.target.value);
      }}
      onBlur={() => {
        setEditing(false);
        if (!touched.current) return;
        const pattern = allowNegative ? /[^0-9.-]/g : /[^0-9.]/g;
        const n = parseFloat(raw.replace(pattern, "")) || 0;
        if (n !== value) onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setEditing(false);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onWheel={(e) => (e.target as HTMLInputElement).blur()}
      className={`w-20 rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-sm tabular-nums focus:border-gray-200 focus:outline-none dark:focus:border-gray-700 ${
        color ? "font-semibold" : ""
      } ${className}`}
    />
  );
}
