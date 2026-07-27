import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRemuneration,
  saveRemunerationRow,
  deleteRemunerationRow,
} from "../api/remuneration";
import type { RemunerationRow } from "../types/remuneration";

export function useRemuneration() {
  return useQuery({
    queryKey: ["remuneration"],
    queryFn: fetchRemuneration,
  });
}

export function useSaveRemunerationRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ row, originalPeriod }: { row: RemunerationRow; originalPeriod?: string }) =>
      saveRemunerationRow(row, originalPeriod),
    meta: { success: "Remuneration saved", error: "Couldn't save remuneration" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remuneration"] }),
  });
}

export function useDeleteRemunerationRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (period: string) => deleteRemunerationRow(period),
    meta: { success: "Salary period removed", error: "Couldn't remove it" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remuneration"] }),
  });
}
