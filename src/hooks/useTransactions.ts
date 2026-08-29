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
 * Categorising a row from the transactions table flags this exact row (flag_id
 * identifies one transaction and nothing else) and, by default, saves a
 * category rule keyed on the description so the same merchant maps itself next
 * time it comes in. The rule is stamped with the time it was saved and applies
 * from there on, so rows already on screen keep the category they had.
 *
 * A row marked one-time is an exception rather than a new answer for the
 * merchant, so it writes no rule at all: that CO-OP visit becomes Other and
 * every other CO-OP line stays Groceries.
 */
export function useSetCategory(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flagId,
      description,
      subcategory,
      oneTime,
    }: {
      flagId: string;
      description: string;
      subcategory: string;
      oneTime: boolean;
    }) => {
      await setTransactionFlag(flagId, { month, subcategory });
      if (!oneTime && description.trim()) await saveCategoryRule(description, subcategory);
    },
    meta: { success: "Saved", error: "Couldn't save change" },
    onSuccess: () => {
      // Rules are description-based, so rows in other months can change too.
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["category-rules"] });
    },
  });
}

/**
 * Marking a row one-time (or clearing it) — kept apart from useSetFlag because
 * ticking it can unpin the merchant rule the row's own category change wrote,
 * which changes what other rows and other months show.
 */
export function useSetOneTime(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      flagId,
      description,
      oneTime,
    }: {
      flagId: string;
      description: string;
      oneTime: boolean;
    }) => setTransactionFlag(flagId, { month, one_time: oneTime, description }),
    meta: { success: "Saved", error: "Couldn't save change" },
    onSuccess: () => {
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
