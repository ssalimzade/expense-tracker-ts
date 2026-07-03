import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAllPlanner, fetchPlanner, savePlanner } from "../api/planner";
import type { BudgetMap } from "../types/budget";

export function usePlanner(month: string) {
  return useQuery({
    queryKey: ["planner", month],
    queryFn: () => fetchPlanner(month),
    enabled: !!month,
  });
}

/** All months' planner entries — used by Projections to link the Monthly row. */
export function useAllPlanner() {
  return useQuery({
    queryKey: ["planner", "all"],
    queryFn: fetchAllPlanner,
  });
}

export function useSavePlanner(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ daysOff, budgets }: { daysOff: number[]; budgets: BudgetMap }) =>
      savePlanner(month, daysOff, budgets),
    meta: { success: "Plan saved", error: "Couldn't save plan" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planner"] }),
  });
}
