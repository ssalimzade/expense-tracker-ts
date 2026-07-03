import type { Repayment } from "../../types/repayment";
import { pivot } from "../../lib/repayments";
import { gbp } from "../../lib/format";
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
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Breakdown by months
        </h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="pb-2 pr-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
              {months.map((m) => (
                <th key={m} className="pb-2 pr-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                  {m}
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

      {/* Mobile cards — one per category */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {rows.map((r) => {
          const muted = r.category === "Uncategorized";
          return (
            <li key={r.category} className={`py-2.5 ${muted ? "opacity-40" : ""}`}>
              <div className="font-medium text-gray-700 dark:text-gray-300">{r.category}</div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {months.map((m) =>
                  r.values[m] ? (
                    <span key={m} className="text-gray-400">
                      {m} <span className="font-semibold text-gray-600 dark:text-gray-300">{gbp(r.values[m])}</span>
                    </span>
                  ) : null,
                )}
              </div>
            </li>
          );
        })}
        <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 py-2.5 text-xs font-bold dark:border-gray-700">
          <span className="uppercase tracking-wider text-gray-900 dark:text-white">Total</span>
          {months.map((m) => (
            <span key={m} className="text-gray-900 dark:text-white">
              {m} {gbp(colTotal(m))}
            </span>
          ))}
        </li>
      </ul>
    </Card>
  );
}
