import type { BudgetMap } from "../../types/budget";
import { gbp0 as gbp } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import { MAIN_CATEGORIES } from "../../types/categories";
import { Card } from "../common";
import CurrencyInput from "../CurrencyInput";

interface Props {
  draft: BudgetMap;
  spentByCategory: Record<string, number>;
  onChange: (category: string, value: number) => void;
  onCommit: (category: string, value: number) => void;
  saving: boolean;
  month: string;
}

export default function BudgetSummaryTable({ draft, spentByCategory, onChange, onCommit, saving, month }: Props) {
  function exportCsv() {
    const header = ["Category", "Budget (£)", "Spent (£)", "Remaining (£)"];
    const rows = MAIN_CATEGORIES.map((cat) => {
      const budget = draft[cat] ?? 0;
      const spent = spentByCategory[cat] ?? 0;
      return [cat, String(budget), String(spent), String(budget - spent)];
    });
    downloadCsv(`budget-breakdown-${month}.csv`, [header, ...rows]);
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between bg-indigo-600 dark:bg-indigo-900 px-6 py-4">
        <h2 className="text-sm font-bold text-white">Budget Breakdown</h2>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="flex items-center gap-1 text-xs text-indigo-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              Saving…
            </span>
          )}
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-400 dark:bg-indigo-800 dark:hover:bg-indigo-700"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3">
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8.53 10.78a.75.75 0 0 1-1.06 0L4.22 7.53a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1ZM1.5 13.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75Z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>
      <table className="w-full table-fixed text-sm">
        <colgroup>
          <col className="w-56" />
          <col className="w-40" />
          <col className="w-40" />
          <col className="w-40" />
          <col className="w-20" />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-100 dark:border-gray-800">
            <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Budget</th>
            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Spent</th>
            <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Remaining</th>
            <th className="pl-2 pr-6 py-3 text-center text-xs font-semibold uppercase leading-tight text-gray-600 dark:text-white">% Remaining</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {MAIN_CATEGORIES.map((cat) => {
            const budget = draft[cat] ?? 0;
            const spent = spentByCategory[cat] ?? 0;
            const remaining = budget - spent;
            const pct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 999 : 0;
            return (
              <tr key={cat} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{cat}</td>
                <td className="px-6 py-3 text-center">
                  <CurrencyInput
                    value={budget}
                    onLiveChange={(n) => onChange(cat, n)}
                    onCommit={(n) => onCommit(cat, n ?? 0)}
                    className="w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-white focus:border-gray-200 focus:outline-none dark:focus:border-gray-700"
                  />
                </td>
                <td className="px-6 py-3 text-center text-white dark:text-white">{gbp(spent)}</td>
                <td className={`px-6 py-3 text-center font-semibold ${remaining < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {gbp(remaining)}
                </td>
                <td className="pl-2 pr-6 py-3">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                    <span className="w-7 shrink-0 text-center text-[10px] text-gray-400">{pct > 999 ? "—" : `${pct.toFixed(0)}%`}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
