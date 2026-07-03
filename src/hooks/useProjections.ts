import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchProjections, saveProjectionRow } from "../api/projections";
import type { ProjectionRow } from "../types/projections";

export function useProjections() {
  return useQuery({
    queryKey: ["projections"],
    queryFn: fetchProjections,
  });
}

export function useSaveProjectionRow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (row: ProjectionRow) => saveProjectionRow(row),
    meta: { success: "Projection saved", error: "Couldn't save projection" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projections"] }),
  });
}
