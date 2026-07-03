import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRemuneration, saveRemunerationRow } from "../api/remuneration";
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
    mutationFn: (row: RemunerationRow) => saveRemunerationRow(row),
    meta: { success: "Remuneration saved", error: "Couldn't save remuneration" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["remuneration"] }),
  });
}
