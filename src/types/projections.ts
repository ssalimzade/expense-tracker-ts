export interface ProjectionRow {
  month: string; // "YYYY-MM"
  salary: number;
  bonus: number;
  monthly_costs: number;
  housing_costs: number; // legacy; Rent is now pulled from the Rent tab
  home_contributions: number; // legacy; now sourced from the Savings tab
  savings: number; // legacy; now sourced from the Savings tab
  investments: number; // legacy; now sourced from the Savings tab
  other_pl: number;
  notes: string;
}

/** Fields stored on the projection row itself (the rest are linked from other tabs).
 *  `housing_costs` is the optional Rent override (defaults to the Rent tab total). */
export type ProjectionInput = "salary" | "bonus" | "monthly_costs" | "other_pl" | "housing_costs";

/** Allocation fields that live in the Savings tab. */
export type AllocationField = "home_contributions" | "savings" | "investments";

/**
 * A single month of the plan, assembled from three sources:
 *  - projection row: salary, bonus, monthly_costs, other_pl, notes
 *  - Rent tab:       rent (total of that month's line items)
 *  - Savings tab:    home_contributions, savings, investments
 */
export interface ProjectionView {
  month: string;
  salary: number;
  bonus: number;
  monthly_costs: number;
  other_pl: number;
  notes: string;
  rent: number;
  home_contributions: number;
  savings: number;
  investments: number;
  // derived
  totalCosts: number; // monthly_costs + rent
  buffer: number; // salary + bonus + other_pl - totalCosts - home - savings - invest
}

export function deriveView(v: Omit<ProjectionView, "totalCosts" | "buffer">): ProjectionView {
  const totalCosts = v.monthly_costs + v.rent;
  const buffer =
    v.salary + v.bonus + v.other_pl - totalCosts - v.home_contributions - v.savings - v.investments;
  return { ...v, totalCosts, buffer };
}
