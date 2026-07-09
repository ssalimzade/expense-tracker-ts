import type { Repayment } from "../../types/repayment";
import { pivot } from "../../lib/repayments";
import { gbp, formatMonthLabel } from "../../lib/format";
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

  return (
    <Card className="overflow-hidden max-md:!p-0">
      <div className="mb-4 max-md:mb-2 max-md:px-4 max-md:pt-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Breakdown by months
        </h2>
      </div>
      <div className="overflow-x-auto max-md:px-4 max-md:pb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
              {months.map((m) => (
                <th key={m} className="pb-2 pr-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                  {formatMonthLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((r) => {
              const muted = r.category === "Uncategorized";
              return (
                <tr key={r.category} className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 ${muted ? "opacity-40" : ""}`}>
                  <td className="py-2.5 pr-4 font-medium text-gray-700 dark:text-gray-300">{r.category}</td>
                  {months.map((m) => (
                    <td key={m} className="py-2.5 pr-4 text-center text-gray-600 dark:text-gray-400">
                      {r.values[m] ? gbp(r.values[m]) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-200 dark:border-gray-700">
              <td className="pt-2.5 pr-4 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Total</td>
              {months.map((m) => (
                <td key={m} className="pt-2.5 pr-4 text-center font-bold text-gray-900 dark:text-white">
                  {gbp(colTotal(m))}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}
