import { useRepayments } from "../../hooks/useRepayments";
import { filterActiveRepayments, pivot } from "../../lib/repayments";
import { gbp0 as gbp } from "../../lib/format";
import { Card, QueryState } from "../common";

interface Props {
  month: string; // YYYY-MM being planned
  /** Apply a category's repayment total into the planned budget. */
  onApply: (category: string, amount: number) => void;
}

export default function RepaymentHints({ month, onApply }: Props) {
  const repaymentsQuery = useRepayments();

  return (
    <Card>
      <div className="mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Repayments due
        </h2>
      </div>
      <QueryState isLoading={repaymentsQuery.isLoading} error={repaymentsQuery.error}>
        {(() => {
          // Mirror the Repayments tab exactly: filter to the month, pivot by
          // category, and drop "Uncategorized" (excluded from totals there).
          const active = filterActiveRepayments(repaymentsQuery.data ?? [], [month]);
          const { rows: pivotRows } = pivot(active, [month]);
          const rows = pivotRows
            .filter((r) => r.category !== "Uncategorized")
            .map((r) => ({ category: r.category, amount: r.values[month] ?? 0 }))
            .filter((r) => r.amount > 0)
            .sort((a, b) => b.amount - a.amount);
          const total = rows.reduce((s, r) => s + r.amount, 0);

          if (rows.length === 0) {
            return (
              <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">
                No scheduled repayments for this month.
              </p>
            );
          }

          return (
            <div className="space-y-1.5">
              <p className="text-[11px] leading-tight text-gray-400 dark:text-gray-500">
                From your Flex splits scheduled this month. Click a row to add it to that
                category's planned budget.
              </p>
              {rows.map((r) => (
                <button
                  key={r.category}
                  onClick={() => onApply(r.category, r.amount)}
                  className="group flex w-full items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50 dark:border-gray-800 dark:bg-gray-800/50 dark:hover:border-indigo-800 dark:hover:bg-indigo-950"
                >
                  <span className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                    {r.category}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-gray-900 dark:text-white">
                      {gbp(r.amount)}
                    </span>
                    <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-indigo-900 dark:text-indigo-300">
                      + add
                    </span>
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between border-t border-gray-100 px-3 pt-2.5 dark:border-gray-800">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Total</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{gbp(total)}</span>
                  {/* invisible spacer matching the row "+ add" badge so totals align */}
                  <span className="invisible rounded px-1.5 py-0.5 text-[10px] font-medium">+ add</span>
                </span>
              </div>
            </div>
          );
        })()}
      </QueryState>
    </Card>
  );
}
