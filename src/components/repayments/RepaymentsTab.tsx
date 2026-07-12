import { useState } from "react";
import { useRepayments, useDeleteRepayment, useRestoreRepayment } from "../../hooks/useRepayments";
import { QueryState, Card } from "../common";
import RepaymentTable from "./RepaymentTable";
import RepaymentPivot from "./RepaymentPivot";
import DailyRepaymentChart from "./DailyRepaymentChart";
import SyntheticRepaymentsPanel from "./SyntheticRepaymentsPanel";
import { filterActiveRepayments, visibleRepaymentMonths } from "../../lib/repayments";
import type { Repayment } from "../../types/repayment";

export default function RepaymentsTab() {
  const repaymentsQuery = useRepayments();
  const del = useDeleteRepayment();
  const restore = useRestoreRepayment();
  const months = visibleRepaymentMonths();

  // Undo list: keeps recently-deleted repayments so the user can restore them
  const [deleted, setDeleted] = useState<{ id: string; description: string }[]>([]);

  const handleDelete = (r: Repayment) => {
    del.mutate(r.id, {
      onSuccess: () => {
        setDeleted((prev) => [...prev, { id: r.id, description: r.description }]);
      },
    });
  };

  const handleRestore = (id: string) => {
    restore.mutate(id, {
      onSuccess: () => {
        setDeleted((prev) => prev.filter((d) => d.id !== id));
      },
    });
  };

  return (
    <QueryState isLoading={repaymentsQuery.isLoading} error={repaymentsQuery.error}>
      {(() => {
        const allRepayments = repaymentsQuery.data ?? [];
        const active = filterActiveRepayments(allRepayments, months);
        const monthLabel = months.join(" · ");

        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-400">Showing</span>
              <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                {monthLabel}
              </span>
              <span className="text-xs text-gray-400">· {active.length} active repayments</span>
            </div>

            <DailyRepaymentChart repayments={active} visibleMonths={months} />
            <RepaymentPivot repayments={active} visibleMonths={months} />
            <RepaymentTable repayments={active} onDelete={handleDelete} />
            <SyntheticRepaymentsPanel visibleMonths={months} />

            {/* Undo list */}
            {deleted.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {deleted.length} deleted — undo?
                  </span>
                  <button
                    onClick={() => setDeleted([])}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {deleted.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{d.description}</span>
                      <button
                        onClick={() => handleRestore(d.id)}
                        className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        );
      })()}
    </QueryState>
  );
}
