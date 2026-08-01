import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRent, saveRentMonth, saveRentPot } from "../api/rent";
import type { RentData, RentMonthEntry, RentPotSettlement, RentReconciled } from "../types/rent";

/**
 * Drop the matches the user has unlinked. `reconciled` is recomputed from the
 * bank tables on every fetch and never stores the override, so it has to be
 * applied here — once, on the way in, rather than in each of the half-dozen
 * places that read a match. Everything downstream then agrees by construction.
 */
function applyUnlinked(data: RentData): RentData {
  const reconciled = data.reconciled;
  if (!reconciled) return data;
  let next: RentReconciled | undefined;
  const removed: RentReconciled = {};
  for (const [month, matches] of Object.entries(reconciled)) {
    for (const [key, match] of Object.entries(matches)) {
      if (!data.months?.[month]?.[key]?.unlinked) continue;
      // Copy lazily: months with nothing unlinked keep their original object.
      next ??= { ...reconciled };
      const { [key]: _dropped, ...rest } = next[month];
      next[month] = rest;
      (removed[month] ??= {})[key] = match;
    }
  }
  return next ? { ...data, reconciled: next, unlinked_matches: removed } : data;
}

export function useRent() {
  return useQuery({
    queryKey: ["rent"],
    queryFn: fetchRent,
    select: applyUnlinked,
  });
}

export function useSaveRentMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, entry }: { month: string; entry: RentMonthEntry }) =>
      saveRentMonth(month, entry),
    meta: { success: "Rent saved", error: "Couldn't save rent" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rent"] }),
  });
}

export function useSaveRentPot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, settlements }: { key: string; settlements: RentPotSettlement[] }) =>
      saveRentPot(key, settlements),
    meta: { success: "Pot updated", error: "Couldn't update pot" },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rent"] }),
  });
}
