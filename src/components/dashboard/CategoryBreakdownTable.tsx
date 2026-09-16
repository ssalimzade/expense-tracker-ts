import type { ReactNode } from "react";
import { gbp0 as gbp } from "../../lib/format";

export interface BreakdownRow {
  category: string;
  budget: number;
  spent: number;
}

/** Share of the budget used; 999 marks spend with no budget at all. */
export const usedPct = (budget: number, spent: number) =>
  budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;

export const usedBarColor = (pct: number) =>
  pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500";

/**
 * The desktop category table shared by Budget and History, so the two stay
 * identical. Budget passes an editable budget cell; History shows plain figures
 * and a totals row.
 */
export default function CategoryBreakdownTable({
  rows,
  renderBudget,
  totals,
}: {
  rows: BreakdownRow[];
  renderBudget?: (row: BreakdownRow) => ReactNode;
  totals?: { budget: number; spent: number };
}) {
  const th = "py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400";
  const num = "py-3 pl-4 text-right tabular-nums";
  const remainingClass = (n: number) =>
    n < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[640px] text-sm">
        <colgroup>
          <col className="w-[18%]" />
          <col />
          <col className="w-36" />
          <col className="w-36" />
          <col className="w-40" />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className={`${th} pl-6 text-left`}>Category</th>
            <th className={`${th} pl-4 text-left`}>Used</th>
            <th className={`${th} pl-4 text-right`}>Budget</th>
            <th className={`${th} pl-4 text-right`}>Spent</th>
            <th className={`${th} pl-4 pr-6 text-right`}>Remaining</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {rows.map((row) => {
            const pct = usedPct(row.budget, row.spent);
            const remaining = row.budget - row.spent;
            return (
              <tr key={row.category} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="py-3 pl-6 font-medium text-gray-800 dark:text-gray-100">{row.category}</td>
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`h-full rounded-full transition-all ${usedBarColor(pct)}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-right text-xs tabular-nums text-gray-400">
                      {pct >= 999 ? "—" : `${pct.toFixed(0)}%`}
                    </span>
                  </div>
                </td>
                <td className={`${num} text-gray-900 dark:text-white`}>
                  {renderBudget ? renderBudget(row) : gbp(row.budget)}
                </td>
                <td className={`${num} text-gray-600 dark:text-gray-300`}>{gbp(row.spent)}</td>
                <td className={`${num} pr-6 font-semibold ${remainingClass(remaining)}`}>{gbp(remaining)}</td>
              </tr>
            );
          })}
        </tbody>
        {totals && (
          <tfoot>
            <tr className="border-t-2 border-gray-200 dark:border-gray-700">
              <td className="py-3 pl-6 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Total</td>
              <td className="py-3 pl-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${usedBarColor(usedPct(totals.budget, totals.spent))}`}
                      style={{ width: `${Math.min(usedPct(totals.budget, totals.spent), 100)}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300">
                    {usedPct(totals.budget, totals.spent) >= 999 ? "—" : `${usedPct(totals.budget, totals.spent).toFixed(0)}%`}
                  </span>
                </div>
              </td>
              <td className={`${num} font-bold text-gray-900 dark:text-white`}>{gbp(totals.budget)}</td>
              <td className={`${num} font-bold text-gray-900 dark:text-white`}>{gbp(totals.spent)}</td>
              <td className={`${num} pr-6 font-bold ${remainingClass(totals.budget - totals.spent)}`}>
                {gbp(totals.budget - totals.spent)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
