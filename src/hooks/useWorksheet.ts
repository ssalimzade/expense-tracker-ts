import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchWorksheet, saveWorksheet } from "../api/worksheet";
import type { WorksheetDoc } from "../types/worksheet";

export function useWorksheet() {
  return useQuery({
    queryKey: ["worksheet"],
    queryFn: fetchWorksheet,
    // Same-device tab switches must NOT refetch: a GET fired on remount can read
    // the server before a just-made save has committed, and reseeding on that
    // stale read wipes the edit. The editor keeps the cache current via
    // setQueryData, so remounts read local edits from the cache instead.
    refetchOnMount: false,
    // Pick up another device's edits only when returning to this window, and hold
    // data "fresh" for 30s so a focus refetch can't race a fresh local save.
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useSaveWorksheet() {
  return useMutation({
    mutationFn: (doc: WorksheetDoc) => saveWorksheet(doc),
    meta: { error: "Couldn't save worksheet" },
  });
}
