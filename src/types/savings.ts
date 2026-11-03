export interface SavingsRow {
  start_date: string;
  end_date: string;
  starting_balance: number;
  home_contributions: number;
  savings: number;
  adjustments: number;
  investments: number;
  ending_balance: number;
  adjustment_notes: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  /** "YYYY-MM" the monthly saving starts going in; null starts it next month. */
  start: string | null;
  /** "YYYY-MM" to reach it by, or null for no deadline. */
  deadline: string | null;
  /** What's already put by for it. Null counts the whole savings balance. */
  saved: number | null;
  /** The monthly amount settled on in the planner; null until one is picked. */
  monthly: number | null;
  created_at?: string;
}
