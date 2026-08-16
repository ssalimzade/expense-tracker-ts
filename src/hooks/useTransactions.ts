import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTransactions,
  setTransactionFlag,
  deleteTransactionFlag,
} from "../api/transactions";
import { saveCategoryRule } from "../api/budgets";
import type { FlagUpdate } from "../types/transaction";

export function useTransactions(month: string) {
  return useQuery({
    queryKey: ["transactions", month],
    queryFn: () => fetchTransactions(month),
    enabled: !!month,
  });
}

export function useSetFlag(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flagId, update }: { flagId: string; update: FlagUpdate }) =>
      setTransactionFlag(flagId, update),
    meta: { success: "Saved", error: "Couldn't save change" },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month] });
    },
  });
}

/**
 * Categorising a row from the transactions table does two things: it flags this
 * exact row (flag_id is a hash of description + timestamp, so it only ever
 * matches this one transaction) and it saves a category rule keyed on the
 * description, so the same merchant maps itself next time it comes in.
 */
export function useSetCategory(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flagId,
      description,
      subcategory,
    }: {
      flagId: string;
      description: string;
      subcategory: string;
    }) => {
      await setTransactionFlag(flagId, { month, subcategory });
      if (description.trim()) await saveCategoryRule(description, subcategory);
    },
    meta: { success: "Saved", error: "Couldn't save change" },
    onSuccess: () => {
      // Rules are description-based, so rows in other months can change too.
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["category-rules"] });
    },
  });
}

export function useDeleteFlag(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (flagId: string) => deleteTransactionFlag(flagId, month),
    meta: { success: "Flag removed", error: "Couldn't remove flag" },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions", month] });
    },
  });
}
