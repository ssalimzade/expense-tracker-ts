import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchWorksheet, saveWorksheet } from "../api/worksheet";
import type { WorksheetDoc } from "../types/worksheet";

export function useWorksheet() {
  return useQuery({
    queryKey: ["worksheet"],
    queryFn: fetchWorksheet,
  });
}

export function useSaveWorksheet() {
  return useMutation({
    mutationFn: (doc: WorksheetDoc) => saveWorksheet(doc),
    meta: { error: "Couldn't save worksheet" },
  });
}
