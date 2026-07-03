import { api } from "./client";
import type { Budget, BudgetMap, CategoryRules } from "../types/budget";

export const fetchBudget = (month: string) =>
  api.get<Budget>(`/budgets?month=${encodeURIComponent(month)}`);

// All months' budgets, keyed by "YYYY-MM".
export const fetchAllBudgets = () =>
  api.get<Record<string, BudgetMap>>("/budgets/all");

export const saveBudget = (month: string, budgets: BudgetMap) =>
  api.post<Budget>(`/budgets/${month}`, { budgets });

export const fetchCategoryRules = () => api.get<CategoryRules>("/category-rules");

export const saveCategoryRule = (description: string, subcategory: string) =>
  api.post("/category-rules", { description, subcategory });
