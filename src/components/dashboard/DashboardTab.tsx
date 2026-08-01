import { useEffect, useState } from "react";
import { useTransactions } from "../../hooks/useTransactions";
import { useBudget, useSaveBudget } from "../../hooks/useBudget";
import { useArchive } from "../../hooks/useArchive";
import { useSyntheticRepayments } from "../../hooks/useRepayments";
import { spendByCategory, totalSpend } from "../../lib/spend";
import type { BudgetMap } from "../../types/budget";
import { MAIN_CATEGORIES } from "../../types/categories";
import { QueryState } from "../common";
import MetricsBar from "./MetricsBar";
import BudgetSummaryTable from "./BudgetSummaryTable";
import CumulativeSpendChart from "./CumulativeSpendChart";
import BalanceSection from "./BalanceSection";
import { toMonthKey } from "../../lib/format";

export default function DashboardTab({ month }: { month: string }) {
  const currentMonth = toMonthKey(new Date());
  const isPastMonth = month < currentMonth;

  const txQuery = useTransactions(month);
  const budgetQuery = useBudget(month);
  // For past months, fetch the frozen archive snapshot instead of computing live.
  const archiveQuery = useArchive(isPastMonth ? month : null);
  const syntheticQuery = useSyntheticRepayments();
  const saveBudget = useSaveBudget(month);

  const [draft, setDraft] = useState<BudgetMap>({});
  const serverBudgets = budgetQuery.data?.budgets;
  useEffect(() => {
    if (serverBudgets) setDraft(serverBudgets);
  }, [serverBudgets]);

  // Block rendering until archive resolves (success or 404 error) so we don't
  // flash live data before switching to the snapshot.
  const archivePending = isPastMonth && archiveQuery.isLoading;

  return (
    <QueryState
      isLoading={txQuery.isLoading || budgetQuery.isLoading || archivePending}
      error={txQuery.error || budgetQuery.error}
    >
      {(() => {
        const transactions = txQuery.data ?? [];

        const archiveRows =
          isPastMonth && archiveQuery.isSuccess ? (archiveQuery.data ?? []) : [];
        const hasArchive = archiveRows.length > 0;

        // Use frozen snapshot for past months; live calculation for current month
        // or any past month that hasn't been archived yet.
        const spent: Record<string, number> = hasArchive
          ? Object.fromEntries(archiveRows.map((r) => [r.Category, r["Spent (£)"]]))
          : spendByCategory(transactions);

        const totalSpentValue = hasArchive
          ? archiveRows.reduce((s, r) => s + r["Spent (£)"], 0)
          : totalSpend(transactions);

        // Only the categories the breakdown table actually renders — a stale key
        // left in the saved map must not inflate the headline.
        const totalBudget = MAIN_CATEGORIES.reduce((a, cat) => a + (draft[cat] ?? 0), 0);

        // Flex repayments are pushed in as synthetic rows dated the 1st, so they
        // are spend the month opens with rather than spend it can pace into.
        const repaymentsBaseline = (syntheticQuery.data ?? [])
          .filter((r) => r.month === month)
          .reduce((s, r) => s + Math.abs(r.amount), 0);

        const setCategory = (category: string, value: number) =>
          setDraft((prev) => ({ ...prev, [category]: value }));

        const commit = (category: string, value: number) => {
          const next = { ...draft, [category]: value };
          setDraft(next);
          saveBudget.mutate(next);
        };

        return (
          <div className="space-y-4">
            <MetricsBar totalBudget={totalBudget} totalSpent={totalSpentValue} />
            <CumulativeSpendChart
              transactions={transactions}
              month={month}
              totalBudget={totalBudget}
              repaymentsBaseline={repaymentsBaseline}
            />
            <BalanceSection month={month} />
            <BudgetSummaryTable
              draft={draft}
              spentByCategory={spent}
              onChange={setCategory}
              onCommit={commit}
              saving={saveBudget.isPending}
              month={month}
            />
          </div>
        );
      })()}
    </QueryState>
  );
}
