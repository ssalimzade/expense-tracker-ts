import { useState } from "react";
import { openingMonth } from "../lib/format";

/**
 * Month tables open on this month and the last couple; anything older is one
 * tap away, and one tap folds it back. `monthOf` reads a row's "YYYY-MM".
 *
 * Viewing a year that doesn't contain the current month shows it whole — there
 * is no "recent" to open on.
 */
export function useEarlierMonths<T>(rows: T[], monthOf: (row: T) => string, currentMonth: string) {
  const [expanded, setExpanded] = useState(false);
  const hasCurrent = rows.some((r) => monthOf(r) === currentMonth);
  const recent = hasCurrent ? rows.filter((r) => monthOf(r) >= openingMonth(currentMonth)) : rows;
  return {
    shown: expanded ? rows : recent,
    /** How many months the short view leaves out — 0 means there's nothing to toggle. */
    earlier: rows.length - recent.length,
    expanded,
    toggle: () => setExpanded((e) => !e),
  };
}

/** The button that expands the earlier months, then collapses them again. */
export function EarlierMonthsButton({
  earlier,
  expanded,
  onToggle,
  className,
}: {
  earlier: number;
  expanded: boolean;
  onToggle: () => void;
  className: string;
}) {
  if (earlier === 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={`flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-gray-500 dark:text-gray-400 ${className}`}
    >
      <svg
        viewBox="0 0 16 16"
        fill="currentColor"
        className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
      >
        <path fillRule="evenodd" d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
      </svg>
      {expanded ? "Show recent months only" : `Show ${earlier} earlier month${earlier === 1 ? "" : "s"}`}
    </button>
  );
}
