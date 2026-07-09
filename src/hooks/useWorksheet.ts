import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchWorksheet, saveWorksheet } from "../api/worksheet";
import type { WorksheetDoc } from "../types/worksheet";

export function useWorksheet() {
  return useQuery({
    queryKey: ["worksheet"],
    queryFn: fetchWorksheet,
    // The editor keeps this cache in sync on every edit (see FortuneWorksheet),
    // so never refetch and clobber in-progress edits with the pre-edit snapshot.
    staleTime: Infinity,
  });
}

export function useSaveWorksheet() {
  return useMutation({
    mutationFn: (doc: WorksheetDoc) => saveWorksheet(doc),
    meta: { error: "Couldn't save worksheet" },
  });
}
