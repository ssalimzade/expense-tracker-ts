import { api } from "./client";
import type { SavingsGoal, SavingsRow } from "../types/savings";

export const fetchSavings = () => api.get<SavingsRow[]>("/savings");

export const saveSavingsRow = (row: Partial<SavingsRow>) =>
  api.post<SavingsRow[]>("/savings", row);

export const fetchSavingsGoals = () => api.get<SavingsGoal[]>("/savings/goals");

export const saveSavingsGoal = (goal: Partial<SavingsGoal>) =>
  api.post<SavingsGoal[]>("/savings/goals", goal);

export const deleteSavingsGoal = (id: string) =>
  api.del<SavingsGoal[]>(`/savings/goals/${id}`);
