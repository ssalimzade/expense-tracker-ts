import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTransactions,
  setTransactionFlag,
  deleteTransactionFlag,
} from "../api/transactions";
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
