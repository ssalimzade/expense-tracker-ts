import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBudget,
  fetchAllBudgets,
  saveBudget,
  fetchCategoryRules,
  saveCategoryRule,
} from "../api/budgets";
import type { BudgetMap } from "../types/budget";

export function useBudget(month: string) {
  return useQuery({
    queryKey: ["budget", month],
    queryFn: () => fetchBudget(month),
    enabled: !!month,
  });
}

export function useAllBudgets() {
  return useQuery({
    queryKey: ["budgets", "all"],
    queryFn: fetchAllBudgets,
  });
}

export function useSaveBudget(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (budgets: BudgetMap) => saveBudget(month, budgets),
    meta: { success: "Budget saved", error: "Couldn't save budget" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", month] }),
  });
}

export function useCategoryRules() {
  return useQuery({
    queryKey: ["category-rules"],
    queryFn: fetchCategoryRules,
  });
}

export function useSaveCategoryRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      description,
      subcategory,
    }: {
      description: string;
      subcategory: string;
    }) => saveCategoryRule(description, subcategory),
    meta: { success: "Rule saved", error: "Couldn't save rule" },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-rules"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
