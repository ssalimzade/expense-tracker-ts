import { api } from "./client";
import type { TravelData, Trip, TripExpense } from "../types/travel";

export const fetchTravel = () => api.get<TravelData>("/travel");

/** Today's market rate: `rate` local units per £1, published on `as_of` (YYYY-MM-DD). */
export const fetchRate = (currency: string) =>
  api.get<{ currency: string; rate: number; as_of: string | null }>(`/travel/rate/${currency}`);

export const saveTrip = (trip: Partial<Trip>) => api.post<TravelData>("/travel/trips", trip);

/** Set one category of a trip's plan; an amount of 0 clears it. */
export const saveTripPlanLine = (tripId: string, line: { category: string; amount: number; per_day: boolean }) =>
  api.post<TravelData>(`/travel/trips/${tripId}/plan`, line);

export const deleteTrip = (id: string) => api.del<TravelData>(`/travel/trips/${id}`);

export const saveTripExpense = (expense: Partial<TripExpense>) =>
  api.post<TravelData>("/travel/expenses", expense);

/** Several expenses in one write — used to link a batch of bank transactions. */
export const saveTripExpenses = (expenses: Partial<TripExpense>[]) =>
  api.post<TravelData>("/travel/expenses/batch", expenses);

/** Undo: puts back only the expenses that are still absent (see upsertTripExpenses). */
export const restoreTripExpenses = (expenses: TripExpense[]) =>
  api.post<TravelData>("/travel/expenses/batch?restore=1", expenses);

export const deleteTripExpense = (id: string) => api.del<TravelData>(`/travel/expenses/${id}`);
