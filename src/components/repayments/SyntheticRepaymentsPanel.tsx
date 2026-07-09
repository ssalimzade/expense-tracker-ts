import {
  useSyntheticRepayments,
  useSyncSyntheticRepayments,
  useDeleteSyntheticRepayments,
} from "../../hooks/useRepayments";
import { gbp0, formatMonthLabel } from "../../lib/format";
import { catColor } from "../../lib/repayments";
import { Card } from "../common";
import type { SyntheticRepayment } from "../../types/repayment";

interface Props {
  visibleMonths: string[];
}

/**
 * Shows the synthetic Monzo rows generated from each month's repayment totals.
 * These are auto-created on the first load of a new month (budget categories
 * only — Savings is excluded) so Flex repayments count as spend on the
 * dashboard. Each month can be synced/re-synced or removed by hand.
 */
export default function SyntheticRepaymentsPanel({ visibleMonths }: Props) {
  const { data: synthetic = [] } = useSyntheticRepayments();
  const sync = useSyncSyntheticRepayments();
  const remove = useDeleteSyntheticRepayments();

  const byMonth = new Map<string, SyntheticRepayment[]>();
  for (const s of synthetic) {
    const list = byMonth.get(s.month) ?? [];
    list.push(s);
    byMonth.set(s.month, list);
  }

  const busy = sync.isPending || remove.isPending;

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Pushed to Monzo
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Auto-created on the 1st from each month's repayment totals (budget
          categories only) so they show as spend on the dashboard.
          <span className="mt-1 block">
            <span className="font-medium text-gray-500 dark:text-gray-400">Sync</span> pushes a
            month's totals to Monzo; <span className="font-medium text-gray-500 dark:text-gray-400">Re-sync</span> refreshes
            them if the repayments changed; <span className="font-medium text-gray-500 dark:text-gray-400">Remove</span> clears them.
          </span>
        </p>
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {visibleMonths.map((month) => {
          const entries = (byMonth.get(month) ?? []).slice().sort((a, b) =>
            a.category.localeCompare(b.category),
          );
          const total = entries.reduce((sum, e) => sum + Math.abs(e.amount), 0);
          const synced = entries.length > 0;

          return (
            <div key={month} className="px-4 py-3 sm:px-6 sm:py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {formatMonthLabel(month)}
                  </span>
                  {synced ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {gbp0(total)} · {entries.length} entries
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not synced</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={() => sync.mutate({ month, force: synced })}
                    className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-950 dark:text-indigo-300"
                  >
                    {synced ? "Re-sync" : "Sync"}
                  </button>
                  {synced && (
                    <button
                      disabled={busy}
                      onClick={() => remove.mutate(month)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              {synced && (
                <ul className="ml-1 mt-2 space-y-1 border-l-2 border-gray-100 pl-3 pr-2.5 dark:border-gray-800">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium" style={{ color: catColor(e.category) }}>
                        {e.category}
                      </span>
                      <span className="font-medium tabular-nums" style={{ color: catColor(e.category) }}>
                        {gbp0(Math.abs(e.amount))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
