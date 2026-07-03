import type { BudgetMap } from "./budget";

export interface Planner {
  month: string; // YYYY-MM
  days_off: number[]; // day-of-month numbers marked as off
  budgets: BudgetMap; // planned (draft) budgets, by main category
}
