import { takeHome } from "./tax";
import type { RemunerationRow, RemunerationDerived } from "../types/remuneration";

/**
 * Salary rows are driven by gross pay: pension, deductions and net follow from
 * the same take-home calculator the Salary tab shows, so the two can never
 * disagree. Any of the four can be pinned to a hand-entered number; clearing it
 * hands the field back to the calculation.
 */

export interface DerivedPay {
  pension: number; // negative — money leaving gross
  deductions: number; // negative — tax + NI + taxable benefit
  net_pa: number;
  net_pm: number;
}

/** What the calculator says, ignoring any overrides on the row. */
export function calcPay(row: Pick<RemunerationRow, "gross" | "pension_pct">): DerivedPay {
  const pension_pct = row.pension_pct ?? 0;
  const r = takeHome({
    annual: row.gross ?? 0,
    increasePct: 0,
    vitality: true,
    pension: pension_pct > 0,
    pensionRate: pension_pct,
  });
  const pension = -r.pension;
  const net_pa = r.netAnnual;
  // Mirrors the spreadsheet: whatever gross loses on the way to net, less the
  // pension already accounted for above.
  const deductions = -((row.gross ?? 0) - net_pa + pension);
  return { pension, deductions, net_pa, net_pm: r.netMonthly };
}

/**
 * A pinned figure, or null when the field should be calculated. Zero counts as
 * unset: none of these is ever legitimately 0 on a real salary, and treating it
 * that way means a field left at 0 recovers itself instead of being stuck —
 * clearing an input that already reads £0 fires no change event.
 */
const pinnedValue = (v: number | null | undefined) => (v != null && v !== 0 ? v : null);

/** The figures a row actually shows: calculated, with any overrides applied. */
export function resolvePay(row: RemunerationRow): DerivedPay {
  const auto = calcPay(row);
  return {
    pension: pinnedValue(row.pension) ?? auto.pension,
    deductions: pinnedValue(row.deductions) ?? auto.deductions,
    net_pa: pinnedValue(row.net_pa) ?? auto.net_pa,
    net_pm: pinnedValue(row.net_pm) ?? auto.net_pm,
  };
}

export const isPinned = (row: RemunerationRow, field: RemunerationDerived) =>
  pinnedValue(row[field]) != null;

/** The salary you're on now — always the newest row. */
export const currentRow = (rows: RemunerationRow[]): RemunerationRow | undefined =>
  rows[rows.length - 1];

/** Net monthly for the current salary. */
export function currentNetMonthly(rows: RemunerationRow[]): number {
  const row = currentRow(rows);
  return row ? resolvePay(row).net_pm : 0;
}
