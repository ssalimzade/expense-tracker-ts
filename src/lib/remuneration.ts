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

/** The figures a row actually shows: calculated, with any overrides applied. */
export function resolvePay(row: RemunerationRow): DerivedPay {
  const auto = calcPay(row);
  return {
    pension: row.pension ?? auto.pension,
    deductions: row.deductions ?? auto.deductions,
    net_pa: row.net_pa ?? auto.net_pa,
    net_pm: row.net_pm ?? auto.net_pm,
  };
}

export const isPinned = (row: RemunerationRow, field: RemunerationDerived) => row[field] != null;

/** Net monthly for whichever row is current, falling back to the newest. */
export function currentNetMonthly(rows: RemunerationRow[]): number {
  const row = rows.find((r) => r.current) ?? rows[rows.length - 1];
  return row ? resolvePay(row).net_pm : 0;
}
