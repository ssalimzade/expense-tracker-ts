// UK (England) take-home calculator — replicates the formulas from the
// "Take Home Calculator" block of the London Financial Analysis spreadsheet.
//
// Inputs: base annual salary, an optional pay rise, and Vitality / Pension
// toggles (both modelled exactly as in the sheet).

const PERSONAL_ALLOWANCE = 12571; // sheet uses 12,570 + 1
const BASIC_LIMIT = 50270;
const HIGHER_START = 50271;
const NI_LOWER = 12576; // £1,048/month
const NI_UPPER = 50268; // £4,189/month
const PENSION_RATE = 0.04;
const VITALITY_RATE = 0.031;

export interface TakeHomeInput {
  annual: number;
  increasePct: number; // e.g. 0.16 for +16%
  vitality: boolean;
  pension: boolean;
}

export interface TakeHome {
  gross: number; // after the rise
  pension: number;
  totalEarnings: number; // gross - pension
  medTaxable: number; // Vitality taxable benefit
  paye: number;
  nic: number;
  netAnnual: number;
  netMonthly: number;
}

function payeTax(taxable: number): number {
  const basic = Math.max(0, Math.min(taxable, BASIC_LIMIT) - PERSONAL_ALLOWANCE) * 0.2;
  const higher = Math.max(0, taxable - HIGHER_START) * 0.4;
  return basic + higher;
}

function nationalInsurance(earnings: number): number {
  const band8 = Math.max(0, Math.min(earnings, NI_UPPER) - NI_LOWER) * 0.08;
  const band2 = Math.max(0, earnings - NI_UPPER) * 0.02;
  return band8 + band2;
}

export function takeHome({ annual, increasePct, vitality, pension }: TakeHomeInput): TakeHome {
  const gross = annual * (1 + increasePct);
  const pensionAmt = pension ? gross * PENSION_RATE : 0;
  const totalEarnings = gross - pensionAmt;
  const medTaxable = vitality ? VITALITY_RATE * totalEarnings : 0;
  const paye = payeTax(totalEarnings + medTaxable);
  const nic = nationalInsurance(totalEarnings);
  const netAnnual = totalEarnings - paye - nic;
  return {
    gross,
    pension: pensionAmt,
    totalEarnings,
    medTaxable,
    paye,
    nic,
    netAnnual,
    netMonthly: netAnnual / 12,
  };
}
