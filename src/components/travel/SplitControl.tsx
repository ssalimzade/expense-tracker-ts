import { MAX_SPLIT } from "../../lib/travel";

/**
 * "Split" toggle with a people stepper. `value` is the number of people sharing
 * the cost (1 = not split); switching it on starts at 2.
 */
export default function SplitControl({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (n: number) => void;
  /** Smaller, for list rows. */
  compact?: boolean;
}) {
  const on = value > 1;
  const size = compact ? "h-6 w-6 text-sm" : "h-8 w-8 text-base";
  const step = (d: number) => onChange(Math.min(MAX_SPLIT, Math.max(2, value + d)));
  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <label className={`flex cursor-pointer items-center gap-1.5 font-semibold ${compact ? "text-xs" : "text-sm"}`}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => onChange(e.target.checked ? 2 : 1)}
          className="h-4 w-4 accent-sky-600"
        />
        Split
      </label>
      {on && (
        <div className="flex items-center gap-1" aria-label="People splitting">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={value <= 2}
            aria-label="One fewer person"
            className={`${size} flex items-center justify-center rounded-lg bg-gray-100 font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200`}
          >
            −
          </button>
          <span className={`min-w-[3.25rem] text-center font-semibold tabular-nums ${compact ? "text-xs" : "text-sm"}`}>
            {value} people
          </span>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={value >= MAX_SPLIT}
            aria-label="One more person"
            className={`${size} flex items-center justify-center rounded-lg bg-gray-100 font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-200`}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
