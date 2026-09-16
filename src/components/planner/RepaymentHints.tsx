import { useRepayments } from "../../hooks/useRepayments";
import { filterActiveRepayments, pivot } from "../../lib/repayments";
import { gbp0 as gbp } from "../../lib/format";
import { QueryState } from "../common";

interface Props {
  month: string; // YYYY-MM being planned
  /** Apply a category's repayment total into the planned budget. */
  onApply: (category: string, amount: number) => void;
}

export default function RepaymentHints({ month, onApply }: Props) {
  const repaymentsQuery = useRepayments();

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 sm:p-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Flex repayments due</p>
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
              <p className="pb-1 text-[11px] leading-snug text-gray-400 dark:text-gray-500">
                Tap one to add it to that category's plan.
              </p>
              {rows.map((r) => (
                <button
                  key={r.category}
                  onClick={() => onApply(r.category, r.amount)}
                  className="group flex w-full items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-left transition-colors hover:bg-fuchsia-50 dark:bg-gray-800/50 dark:hover:bg-fuchsia-500/10"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                    {r.category}
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {gbp(r.amount)}
                  </span>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white text-fuchsia-600 shadow-sm transition group-hover:bg-fuchsia-600 group-hover:text-white dark:bg-gray-900 dark:text-fuchsia-300">
                    +
                  </span>
                </button>
              ))}
              <div className="flex items-center gap-2 border-t border-gray-100 px-3 pt-2.5 dark:border-gray-800">
                <span className="flex-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Total</span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">{gbp(total)}</span>
                {/* spacer the width of the row "+" so totals line up */}
                <span className="w-6 shrink-0" />
              </div>
            </div>
          );
        })()}
      </QueryState>
    </div>
  );
}
