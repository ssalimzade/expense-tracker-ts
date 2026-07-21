import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBalance,
  saveBalance,
  fetchAccountBalances,
  type BalanceValues,
} from "../api/balance";

export function useBalance(month: string) {
  return useQuery({
    queryKey: ["balance", month],
    queryFn: () => fetchBalance(month),
    enabled: !!month,
  });
}

/** Live per-account balances, refreshed daily by an external job. */
export function useAccountBalances() {
  return useQuery({
    queryKey: ["account-balances"],
    queryFn: fetchAccountBalances,
  });
}

export function useSaveBalance(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: BalanceValues) => saveBalance(month, values),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["balance", month] }),
  });
}
