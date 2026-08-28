import type { Repayment } from "../../types/repayment";
import { pivot } from "../../lib/repayments";
import { gbp, formatMonthLabel, formatMonthLabelShort } from "../../lib/format";
import { Card } from "../common";

interface Props {
  repayments: Repayment[];
  visibleMonths: string[];
}

export default function RepaymentPivot({ repayments, visibleMonths }: Props) {
  const { months, rows } = pivot(repayments, visibleMonths);

  // Totals count only real categories — Uncategorized is excluded.
  const colTotal = (m: string) =>
    rows.reduce((sum, r) => (r.category === "Uncategorized" ? sum : sum + (r.values[m] ?? 0)), 0);
  // Row total: a category's sum across all visible months.
  const rowTotal = (values: Record<string, number>) =>
    months.reduce((sum, m) => sum + (values[m] ?? 0), 0);
  const grandTotal = months.reduce((sum, m) => sum + colTotal(m), 0);

  return (
    <Card className="overflow-hidden max-md:!p-0">
      <div className="mb-4 max-md:mb-2 max-md:px-4 max-md:pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Breakdown by months
        </h2>
      </div>
      <div className="max-md:px-4 max-md:pb-4 md:overflow-x-auto">
        <table className="w-full table-fixed text-sm md:table-auto">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="w-[24%] pb-2 pr-1 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white md:w-auto md:pr-4">Category</th>
              {months.map((m) => (
                <th key={m} className="pb-2 pr-1 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white md:w-auto md:whitespace-nowrap md:pr-4">
                  <span className="md:hidden">{formatMonthLabelShort(m)}</span>
                  <span className="hidden md:inline">{formatMonthLabel(m)}</span>
                </th>
              ))}
              <th className="border-l border-gray-100 pb-2 pl-1 text-center text-xs font-semibold uppercase tracking-wider text-gray-700 dark:border-gray-800 dark:text-white md:whitespace-nowrap md:pl-3 md:pr-4">
                Total
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((r) => {
              const muted = r.category === "Uncategorized";
              return (
                <tr key={r.category} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${muted ? "opacity-40" : ""}`}>
                  <td className="py-2.5 pr-1 text-xs font-medium text-gray-700 dark:text-gray-300 md:pr-4 md:text-sm">{r.category}</td>
                  {months.map((m) => (
                    <td key={m} className="py-2.5 pr-1 text-center text-xs text-gray-600 dark:text-gray-400 md:pr-4 md:text-sm">
                      {r.values[m] ? gbp(r.values[m]) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  ))}
                  <td className="border-l border-gray-100 py-2.5 pl-1 text-center text-xs font-semibold text-gray-800 dark:border-gray-800 dark:text-gray-200 md:pl-3 md:pr-4 md:text-sm">
                    {rowTotal(r.values) ? gbp(rowTotal(r.values)) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className="pt-2.5 pr-1 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white md:pr-4">Total</td>
              {months.map((m) => (
                <td key={m} className="pt-2.5 pr-1 text-center text-xs font-bold text-gray-900 dark:text-white md:pr-4 md:text-sm">
                  {gbp(colTotal(m))}
                </td>
              ))}
              <td className="border-l border-gray-200 pt-2.5 pl-1 text-center text-xs font-bold text-gray-900 dark:border-gray-700 dark:text-white md:pl-3 md:pr-4 md:text-sm">
                {gbp(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
