import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRent, saveRentMonth } from "../api/rent";
import type { RentMonthEntry } from "../types/rent";

export function useRent() {
  return useQuery({
    queryKey: ["rent"],
    queryFn: fetchRent,
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
