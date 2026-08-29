export type BudgetMap = Record<string, number>;

export interface Budget {
  month: string; // YYYY-MM
  budgets: BudgetMap;
}

export interface CategoryRule {
  subcategory: string;
  // When the rule was saved. It only outranks the built-in keyword lists for
  // transactions that arrived after this. Absent on older stored rules.
  since?: string;
}

export type CategoryRules = Record<string, CategoryRule>;
