export type BudgetMap = Record<string, number>;

export interface Budget {
  month: string; // YYYY-MM
  budgets: BudgetMap;
}

export interface CategoryRule {
  subcategory: string;
}

export type CategoryRules = Record<string, CategoryRule>;
