import { useEffect, useRef } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { fetchTransactions } from "../api/transactions";
import { fetchBudget } from "../api/budgets";
import { saveArchive } from "../api/archive";
import { useArchiveMonths } from "./useArchive";
import { spendByCategory } from "../lib/spend";
import { MAIN_CATEGORIES } from "../types/categories";
import { toMonthKey } from "../lib/format";

/** Returns month keys (YYYY-MM) that are past their 1-day window and not yet archived. */
function monthsToArchive(archived: Set<string>): string[] {
  const today = new Date();
  const current = toMonthKey(today);
  const result: string[] = [];

  let d = new Date(2025, 4, 1); // start from 2025-05
  while (toMonthKey(d) < current) {
    const key = toMonthKey(d);
    // Auto-archive 1 day after month end (i.e. on the 1st of the next month)
    const archiveAfter = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    if (!archived.has(key) && today >= archiveAfter) {
      result.push(key);
    }
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return result;
}

export function useAutoArchive() {
  const archiveMonthsQuery = useArchiveMonths();
  const qc = useQueryClient();
  const saved = useRef(new Set<string>());

  const archived = new Set(archiveMonthsQuery.data ?? []);
  const toArchive = archiveMonthsQuery.isSuccess ? monthsToArchive(archived) : [];

  const txQueries = useQueries({
    queries: toArchive.map((m) => ({
      queryKey: ["transactions", m],
      queryFn: () => fetchTransactions(m),
    })),
  });

  const budgetQueries = useQueries({
    queries: toArchive.map((m) => ({
      queryKey: ["budget", m],
      queryFn: () => fetchBudget(m),
    })),
  });

  // Stable key so the effect only fires when query states change
  const readyKey = toArchive
    .map((_, i) => `${txQueries[i]?.isSuccess ? 1 : 0}${budgetQueries[i]?.isSuccess ? 1 : 0}`)
    .join("");

  useEffect(() => {
    toArchive.forEach((month, i) => {
      if (saved.current.has(month)) return;
      const tx = txQueries[i];
      const bq = budgetQueries[i];
      if (!tx?.isSuccess || !bq?.isSuccess) return;

      saved.current.add(month);

      const transactions = tx.data ?? [];
      const budgets = bq.data?.budgets ?? {};
      const spent = spendByCategory(transactions);

      const rows = MAIN_CATEGORIES.map((cat) => {
        const budget = budgets[cat] ?? 0;
        const s = Math.round((spent[cat] ?? 0) * 100) / 100;
        return {
          Category: cat as string,
          "Budget (£)": budget,
          "Spent (£)": s,
          "Remaining (£)": Math.round((budget - s) * 100) / 100,
        };
      });

      saveArchive(month, rows).then(() => {
        qc.invalidateQueries({ queryKey: ["archive-months"] });
        qc.invalidateQueries({ queryKey: ["archive", month] });
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyKey]);
}
