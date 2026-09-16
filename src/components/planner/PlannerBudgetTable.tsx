import type { BudgetMap } from "../../types/budget";
import { gbp0 as gbp } from "../../lib/format";
import { MAIN_CATEGORIES } from "../../types/categories";
import CurrencyInput from "../CurrencyInput";

interface Props {
  draft: BudgetMap;
  /** Previous month's budget, for reference. */
  lastMonth: BudgetMap;
  /** Full previous-month name, e.g. "September". */
  lastMonthName: string;
  /** 2026 per-category average, for reference. */
  avg2026: BudgetMap;
  onChange: (category: string, value: number) => void;
  onCommit: (category: string, value: number) => void;
}

/**
 * One line per category: the plan as a bar, with ticks where the 2026 average
 * and last month sit, so a figure that's out of line stands out before it's typed.
 */
export default function PlannerBudgetTable({ draft, lastMonth, lastMonthName, avg2026, onChange, onCommit }: Props) {
  const scale = Math.max(
    1,
    ...MAIN_CATEGORIES.flatMap((c) => [draft[c] ?? 0, lastMonth[c] ?? 0, avg2026[c] ?? 0]),
  );
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">The plan</h2>
          <p className="text-xs text-gray-400">Saves as you go</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-gradient-to-r from-[#8ea3c7] to-[#5a6f95]" /> Plan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded bg-gray-400" /> 2026 avg
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 rounded bg-[#c8b58f]" /> {lastMonthName}
          </span>
        </div>
      </div>

      <ul className="overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
        {MAIN_CATEGORIES.map((cat) => {
          const planned = draft[cat] ?? 0;
          const avg = avg2026[cat] ?? 0;
          const last = lastMonth[cat] ?? 0;
          return (
            <li key={cat} className="flex items-center gap-3 border-b border-gray-50 px-4 py-3 last:border-0 dark:border-gray-800/60 sm:gap-4 sm:px-5">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{cat}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-gray-400">
                    avg {gbp(avg)} · <span className="text-[#9c8761] dark:text-[#c8b58f]">{lastMonthName.slice(0, 3)} {gbp(last)}</span>
                  </span>
                </div>
                <div className="relative mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8ea3c7] to-[#5a6f95] transition-[width] duration-300" style={{ width: pct(planned) }} />
                  {avg > 0 && <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-gray-400 dark:bg-gray-500" style={{ left: pct(avg) }} />}
                  {last > 0 && <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-[#c8b58f]" style={{ left: pct(last) }} />}
                </div>
              </div>
              <CurrencyInput
                value={planned}
                onLiveChange={(n) => onChange(cat, n)}
                onCommit={(n) => onCommit(cat, n ?? 0)}
                className="w-24 shrink-0 rounded-xl border border-gray-200 bg-transparent px-2 py-1.5 text-center font-bold tabular-nums text-gray-900 focus:border-[#8ea3c7] focus:outline-none dark:border-gray-700 dark:text-white dark:focus:border-[#8ea3c7] sm:w-28"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
