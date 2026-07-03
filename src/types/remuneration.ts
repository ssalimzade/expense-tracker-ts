export interface RemunerationRow {
  period: string;
  gross: number;
  deductions: number;
  pension: number;
  pension_pct: number; // e.g. 0.04 — used to auto-calc pension
  net_pa: number;
  net_pm: number;
  bonus: number;
  current: boolean;
}
