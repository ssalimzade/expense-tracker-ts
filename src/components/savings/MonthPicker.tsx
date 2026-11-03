import { useRef, useState } from "react";
import { formatMonthLabel } from "../../lib/format";
import { addMonths, monthsBetween, spanLabel } from "../../lib/savingsGoal";

const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("en-GB", { month: "short" }));
export interface QuickPick {
  label: string;
  /** Months from this one. */
  months: number;
}
/** How far ahead the year arrows go. */
const YEARS_AHEAD = 50;

/**
 * A month field that opens a year of months underneath it — in place rather
 * than as a popover, so it behaves the same in the phone sheet and on desktop.
 * Months before `min` can't be picked, though a saved one stays shown.
 */
export default function MonthPicker({
  value,
  onChange,
  min,
  current,
  placeholder,
  quick,
  clearLabel,
  labelledBy,
  className = "",
}: {
  /** "YYYY-MM", or "" for none. */
  value: string;
  onChange: (v: string) => void;
  /** First month that can be picked, "YYYY-MM". */
  min: string;
  /** This month, for the "… away" note and the quick picks. */
  current: string;
  /** Shown, greyed, while nothing is picked. */
  placeholder: string;
  /** Shortcut chips under the grid. */
  quick: QuickPick[];
  /** The chip that clears the pick. */
  clearLabel: string;
  /** Id of the visible field label, so the field is announced by it. */
  labelledBy?: string;
  /** Classes for the closed field, so it matches the inputs around it. */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number((value || min).slice(0, 4)));
  const trigger = useRef<HTMLButtonElement>(null);
  const minYear = Number(min.slice(0, 4));
  const maxYear = Number(current.slice(0, 4)) + YEARS_AHEAD;
  const away = value ? monthsBetween(current, value) : 0;

  // Each time it opens, show the picked month's year — or the first year that
  // has anything to pick, if the start has moved on since.
  const toggle = () => {
    if (!open) setYear(Number((value && value >= min ? value : min).slice(0, 4)));
    setOpen(!open);
  };
  // The grid goes away under the focused month, so hand focus back to the field.
  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  const pick = (v: string) => {
    onChange(v);
    close();
  };

  return (
    <div
      onKeyDown={(e) => {
        // Escape closes the grid, not the whole dialog around it.
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-labelledby={labelledBy ? `${labelledBy} ${labelledBy}-value` : undefined}
        onClick={toggle}
        className={`${className} flex items-center gap-2 text-left`}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-4 w-4 shrink-0 text-gray-400">
          <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
        <span id={labelledBy ? `${labelledBy}-value` : undefined} className={`min-w-0 flex-1 truncate ${value ? "" : "text-gray-400"}`}>
          {value ? formatMonthLabel(value) : placeholder}
        </span>
        {value && away > 0 && <span className="shrink-0 text-[11px] font-normal text-gray-400">{spanLabel(away)} away</span>}
        <svg viewBox="0 0 16 16" fill="currentColor" className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition ${open ? "rotate-180" : ""}`}>
          <path fillRule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="mt-2 rounded-2xl bg-gray-50 p-3 ring-1 ring-gray-100 dark:bg-gray-900/60 dark:ring-gray-700/60">
          <div className="mb-2 flex items-center justify-between">
            <YearArrow label="Previous year" disabled={year <= minYear} onClick={() => setYear((y) => y - 1)} d="M10 3.5 5.5 8l4.5 4.5" />
            <span className="text-sm font-bold tabular-nums">{year}</span>
            <YearArrow label="Next year" disabled={year >= maxYear} onClick={() => setYear((y) => y + 1)} d="M6 3.5 10.5 8 6 12.5" />
          </div>

          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Months of ${year}`}>
            {MONTHS.map((label, i) => {
              const key = `${year}-${String(i + 1).padStart(2, "0")}`;
              const selected = key === value;
              const disabled = key < min && !selected;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  aria-label={formatMonthLabel(key)}
                  onClick={() => pick(key)}
                  className={`rounded-xl py-2 text-sm font-semibold transition ${
                    selected
                      ? "bg-[#5d7a45] text-white shadow-sm"
                      : disabled
                        ? "cursor-not-allowed text-gray-300 dark:text-gray-600"
                        : "text-gray-700 hover:bg-white dark:text-gray-200 dark:hover:bg-gray-800"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gray-200/70 pt-3 dark:border-gray-700/60">
            {quick.map((q) => {
              const key = addMonths(current, q.months);
              return (
                <button
                  key={q.label}
                  type="button"
                  disabled={key < min}
                  onClick={() => pick(key)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    key === value
                      ? "bg-[#5d7a45] text-white"
                      : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
                  }`}
                >
                  {q.label}
                </button>
              );
            })}
            {value && (
              <button
                type="button"
                onClick={() => pick("")}
                className="ml-auto rounded-full px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-200/60 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                {clearLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function YearArrow({ label, disabled, onClick, d }: { label: string; disabled: boolean; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg p-2.5 text-gray-500 transition hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent dark:text-gray-400 dark:hover:bg-gray-800"
    >
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d={d} />
      </svg>
    </button>
  );
}
