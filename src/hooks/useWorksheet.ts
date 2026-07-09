import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchWorksheet, saveWorksheet } from "../api/worksheet";
import type { WorksheetDoc } from "../types/worksheet";

export function useWorksheet() {
  return useQuery({
    queryKey: ["worksheet"],
    queryFn: fetchWorksheet,
    // Refetch on focus/remount so returning to a device picks up edits made on
    // another one. FortuneWorksheet reseeds the grid when the server has genuinely
    // newer content (and there are no unsaved local edits).
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useSaveWorksheet() {
  return useMutation({
    mutationFn: (doc: WorksheetDoc) => saveWorksheet(doc),
    meta: { error: "Couldn't save worksheet" },
  });
}
