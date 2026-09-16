import { useState } from "react";
import { useRepayments, useDeleteRepayment, useRestoreRepayment } from "../../hooks/useRepayments";
import { QueryState, Card } from "../common";
import RepaymentTable from "./RepaymentTable";
import RepaymentPivot from "./RepaymentPivot";
import DailyRepaymentChart from "./DailyRepaymentChart";
import SyntheticRepaymentsPanel from "./SyntheticRepaymentsPanel";
import { filterActiveRepayments, pivot, visibleRepaymentMonths } from "../../lib/repayments";
import { gbp0, formatMonthLabel } from "../../lib/format";
import Hero, { HeroChip } from "../Hero";
import { CardArt } from "../HeroArt";
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
        // Same totals as the breakdown below: Uncategorized is left out.
        const { rows: pivotRows } = pivot(active, months);
        const monthTotal = (m: string) =>
          pivotRows.reduce((t, r) => (r.category === "Uncategorized" ? t : t + (r.values[m] ?? 0)), 0);
        const totals = months.map((m) => ({ month: m, total: monthTotal(m) }));
        const grand = totals.reduce((t, x) => t + x.total, 0);
        const peak = Math.max(1, ...totals.map((x) => x.total));
        const shortMonth = (m: string) => formatMonthLabel(m).slice(0, 3);

        return (
          <div className="mx-auto max-w-7xl space-y-5">
            <Hero
              gradient="from-[#8c7c68] via-[#6b5d4d] to-[#3f362e]"
              badge={`${formatMonthLabel(months[0])} – ${formatMonthLabel(months[months.length - 1])}`}
              label="Flex still to repay"
              decoration={<CardArt className="md:right-64" />}
              value={gbp0(grand)}
              under={
                <HeroChip>
                  {active.length} active repayment{active.length === 1 ? "" : "s"}
                </HeroChip>
              }
              aside={
                <div className="flex h-28 items-end gap-3">
                  {totals.map((x) => (
                    <div key={x.month} className="flex w-12 flex-col items-center gap-1">
                      <span className="text-[11px] font-bold tabular-nums">{gbp0(x.total)}</span>
                      <div className="w-full rounded-t-lg bg-white/80" style={{ height: `${Math.max(4, (x.total / peak) * 64)}px` }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70">{shortMonth(x.month)}</span>
                    </div>
                  ))}
                </div>
              }
            />

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
