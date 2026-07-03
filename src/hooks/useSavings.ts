import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSavings, saveSavingsRow } from "../api/savings";
import type { SavingsRow } from "../types/savings";

export function useSavings() {
  return useQuery({
    queryKey: ["savings"],
    queryFn: fetchSavings,
  });
}

export function useSaveSavingsRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: Partial<SavingsRow>) => saveSavingsRow(row),
    meta: { success: "Savings saved", error: "Couldn't save savings" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["savings"] }),
  });
}
