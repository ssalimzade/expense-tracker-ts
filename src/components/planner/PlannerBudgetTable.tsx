import type { BudgetMap } from "../../types/budget";
import { gbp0 as gbp } from "../../lib/format";
import { MAIN_CATEGORIES } from "../../types/categories";
import { Card } from "../common";
import CurrencyInput from "../CurrencyInput";

interface Props {
  draft: BudgetMap;
  /** Previous-month budget reference column. */
  lastMonth: BudgetMap;
  lastMonthLabel: string;
  /** 2026 per-category average reference column. */
  avg2026: BudgetMap;
  /** Label for the editable column — the month being planned, e.g. "Jul 2026". */
  planLabel: string;
  onChange: (category: string, value: number) => void;
  onCommit: (category: string, value: number) => void;
  saving: boolean;
  onMoveToBudget: () => void;
  moving: boolean;
}

export default function PlannerBudgetTable({
  draft,
  lastMonth,
  lastMonthLabel,
  avg2026,
  planLabel,
  onChange,
  onCommit,
  saving,
  onMoveToBudget,
  moving,
}: Props) {
  const sum = (m: BudgetMap) => MAIN_CATEGORIES.reduce((s, c) => s + (m[c] ?? 0), 0);
  const total = sum(draft);

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="flex items-center justify-between bg-teal-600 dark:bg-teal-900 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white">Planned Budget</h2>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-teal-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Saving…
            </span>
          )}
        </div>
        <button
          onClick={onMoveToBudget}
          disabled={moving}
          className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 disabled:opacity-60"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M10 3a.75.75 0 0 1 .75.75v8.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-4.5 4.5a.75.75 0 0 1-1.06 0l-4.5-4.5a.75.75 0 1 1 1.06-1.06l3.22 3.22V3.75A.75.75 0 0 1 10 3Z" clipRule="evenodd" />
          </svg>
          Move to Budget
        </button>
      </div>
      <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">2026 Avg</th>
            <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{lastMonthLabel}</th>
            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">{planLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {MAIN_CATEGORIES.map((cat) => {
            const planned = draft[cat] ?? 0;
            return (
              <tr key={cat} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{cat}</td>
                <td className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">{gbp(avg2026[cat] ?? 0)}</td>
                <td className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">{gbp(lastMonth[cat] ?? 0)}</td>
                <td className="px-6 py-3 text-center">
                  <CurrencyInput
                    value={planned}
                    onLiveChange={(n) => onChange(cat, n)}
                    onCommit={(n) => onCommit(cat, n ?? 0)}
                    className="w-28 rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-center font-semibold text-gray-900 focus:border-teal-400 focus:outline-none dark:border-gray-700 dark:text-white dark:focus:border-teal-500"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 font-bold dark:border-gray-700">
            <td className="px-6 py-3 text-left text-gray-700 dark:text-gray-200">Total</td>
            <td className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">{gbp(sum(avg2026))}</td>
            <td className="px-4 py-3 text-center text-gray-400 dark:text-gray-500">{gbp(sum(lastMonth))}</td>
            <td className="px-6 py-3 text-center text-teal-700 dark:text-teal-300">{gbp(total)}</td>
          </tr>
        </tfoot>
      </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {MAIN_CATEGORIES.map((cat) => {
          const planned = draft[cat] ?? 0;
          return (
            <li key={cat} className="px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-800 dark:text-gray-100">{cat}</span>
                <CurrencyInput
                  value={planned}
                  onLiveChange={(n) => onChange(cat, n)}
                  onCommit={(n) => onCommit(cat, n ?? 0)}
                  className="w-24 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-right font-semibold text-gray-900 focus:border-teal-400 focus:outline-none dark:border-gray-700 dark:text-white dark:focus:border-teal-500"
                />
              </div>
              <div className="mt-1.5 flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
                <span>Avg {gbp(avg2026[cat] ?? 0)}</span>
                <span>{lastMonthLabel} {gbp(lastMonth[cat] ?? 0)}</span>
              </div>
            </li>
          );
        })}
        <li className="flex items-center justify-between border-t-2 border-gray-200 px-4 py-3 text-sm font-bold dark:border-gray-700">
          <span className="text-gray-700 dark:text-gray-200">Total</span>
          <span className="text-teal-700 dark:text-teal-300">{gbp(total)}</span>
        </li>
      </ul>
    </Card>
  );
}
