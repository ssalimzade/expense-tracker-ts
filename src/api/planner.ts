import { api } from "./client";
import type { Planner } from "../types/planner";
import type { BudgetMap } from "../types/budget";

export type PlannerEntry = { days_off: number[]; budgets: BudgetMap };

export const fetchAllPlanner = () => api.get<Record<string, PlannerEntry>>(`/planner`);

export const fetchPlanner = (month: string) => api.get<Planner>(`/planner/${month}`);

export const savePlanner = (month: string, daysOff: number[], budgets: BudgetMap) =>
  api.put<Planner>(`/planner/${month}`, { days_off: daysOff, budgets });
