import { useQuery, useQueries } from "@tanstack/react-query";
import { fetchArchiveMonths, fetchArchive } from "../api/archive";
import type { ArchiveRow } from "../types/archive";

export function useArchiveMonths() {
  return useQuery({
    queryKey: ["archive-months"],
    queryFn: fetchArchiveMonths,
  });
}

export function useArchive(month: string | null) {
  return useQuery({
    queryKey: ["archive", month],
    queryFn: () => fetchArchive(month as string),
    enabled: !!month,
  });
}

/** Fetches all archived months in parallel; returns {month, totalSpent, totalBudget}[] */
export function useAllArchives(months: string[]) {
  const results = useQueries({
    queries: months.map((m) => ({
      queryKey: ["archive", m],
      queryFn: () => fetchArchive(m),
      enabled: months.length > 0,
    })),
  });

  const data: { month: string; spent: number; budget: number }[] = [];
  months.forEach((m, i) => {
    const rows = (results[i].data ?? []) as ArchiveRow[];
    const spent = rows.filter((r) => r.Category !== "Uncategorized").reduce((s, r) => s + r["Spent (£)"], 0);
    const budget = rows.reduce((s, r) => s + r["Budget (£)"], 0);
    if (results[i].isSuccess) data.push({ month: m, spent, budget });
  });

  return {
    data,
    isLoading: results.some((r) => r.isLoading),
  };
}
