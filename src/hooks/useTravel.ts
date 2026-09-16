import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTrip,
  deleteTripExpense,
  fetchTravel,
  saveTrip,
  saveTripPlanLine,
  saveTripExpense,
  saveTripExpenses,
  restoreTripExpenses,
} from "../api/travel";
import type { TravelData, Trip, TripExpense } from "../types/travel";

const KEY = ["travel"];

// The server merges each write into one stored blob (read → modify → write), so
// two writes landing together could each miss the other's change. A shared
// scope makes React Query run travel mutations strictly one after another.
const scope = { id: "travel" };

function useTravelMutation<V>(
  fn: (v: V) => Promise<TravelData>,
  meta: { success?: string; error: string },
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    scope,
    meta,
    onSuccess: (data) => qc.setQueryData(KEY, data),
    // On failure the cache may be stale relative to the server — refetch the truth.
    onError: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useTravel() {
  return useQuery({ queryKey: KEY, queryFn: fetchTravel });
}

export const useSaveTrip = () =>
  useTravelMutation((t: Partial<Trip>) => saveTrip(t), { success: "Trip saved", error: "Couldn't save trip" });

export const useSaveTripPlanLine = () =>
  useTravelMutation(
    ({ tripId, ...line }: { tripId: string; category: string; amount: number; per_day: boolean }) =>
      saveTripPlanLine(tripId, line),
    { error: "Couldn't save plan" },
  );

export const useDeleteTrip = () =>
  useTravelMutation((id: string) => deleteTrip(id), { error: "Couldn't delete trip" });

export const useSaveTripExpense = () =>
  useTravelMutation((e: Partial<TripExpense>) => saveTripExpense(e), {
    success: "Expense saved",
    error: "Couldn't save expense",
  });

export const useLinkTransactions = () =>
  useTravelMutation((e: Partial<TripExpense>[]) => saveTripExpenses(e), {
    error: "Couldn't link transactions",
  });

export const useRestoreTripExpenses = () =>
  useTravelMutation((e: TripExpense[]) => restoreTripExpenses(e), { error: "Couldn't undo" });

export const useDeleteTripExpense = () =>
  useTravelMutation((id: string) => deleteTripExpense(id), { error: "Couldn't delete expense" });
