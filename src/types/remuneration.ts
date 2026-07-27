/**
 * One salary period. Only `gross` and `bonus` are entered — everything else is
 * derived from the take-home calculator.
 *
 * The four derived figures double as overrides: a number pins that field, null
 * (or absent) hands it back to the calculation, exactly like the rent tab's
 * paid amounts and the dashboard's diff in bills.
 */
export interface RemunerationRow {
  period: string;
  gross: number;
  bonus: number;
  pension_pct: number; // e.g. 0.04
  current: boolean;

  deductions?: number | null;
  pension?: number | null;
  net_pa?: number | null;
  net_pm?: number | null;
}

/** The fields that are calculated unless pinned. */
export type RemunerationDerived = "pension" | "deductions" | "net_pa" | "net_pm";
