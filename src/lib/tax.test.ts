import { describe, expect, it } from "vitest";
import { takeHome, type TakeHomeInput } from "./tax";

// Default to the plain case — no rise, no Vitality, no pension — so each test
// can turn on exactly the one thing it is about.
const th = (over: Partial<TakeHomeInput> = {}) =>
  takeHome({ annual: 60000, increasePct: 0, vitality: false, pension: false, ...over });

describe("gross", () => {
  it("is the salary itself with no rise", () => {
    expect(th({ annual: 55000 }).gross).toBe(55000);
  });

  it("applies the rise as a multiplier", () => {
    expect(th({ annual: 50000, increasePct: 0.16 }).gross).toBeCloseTo(58000, 2);
  });

  it("handles a zero salary without producing NaN", () => {
    const r = th({ annual: 0 });
    expect(r).toMatchObject({ gross: 0, paye: 0, nic: 0, netAnnual: 0, netMonthly: 0 });
  });
});

describe("PAYE bands", () => {
  it("charges nothing below the personal allowance", () => {
    expect(th({ annual: 12000 }).paye).toBe(0);
  });

  it("charges nothing at exactly the personal allowance", () => {
    expect(th({ annual: 12571 }).paye).toBe(0);
  });

  it("charges 20% on everything above the allowance at basic rate", () => {
    // (30000 − 12571) × 0.2
    expect(th({ annual: 30000 }).paye).toBeCloseTo(3485.8, 2);
  });

  it("stays entirely at basic rate at the top of the band", () => {
    // (50270 − 12571) × 0.2, with no higher-rate slice
    expect(th({ annual: 50270 }).paye).toBeCloseTo(7539.8, 2);
  });

  it("charges 40% only on the slice above the higher-rate start", () => {
    // 7539.8 basic + (60000 − 50271) × 0.4
    expect(th({ annual: 60000 }).paye).toBeCloseTo(11431.4, 2);
  });

  // The sheet this mirrors uses 50270 as the basic ceiling and 50271 as the
  // higher-rate floor, so the pound between them falls in neither band. Pinned
  // to record the intent, not because it is arithmetically tidy.
  it("leaves the pound between the two band edges untaxed", () => {
    expect(th({ annual: 50270.5 }).paye).toBeCloseTo(th({ annual: 50270 }).paye, 2);
  });
});

describe("National Insurance bands", () => {
  it("charges nothing below the lower earnings limit", () => {
    expect(th({ annual: 12000 }).nic).toBe(0);
    expect(th({ annual: 12576 }).nic).toBe(0);
  });

  it("charges 8% between the lower and upper limits", () => {
    // (30000 − 12576) × 0.08
    expect(th({ annual: 30000 }).nic).toBeCloseTo(1393.92, 2);
  });

  it("charges 2% above the upper limit", () => {
    // (50268 − 12576) × 0.08 + (60000 − 50268) × 0.02
    expect(th({ annual: 60000 }).nic).toBeCloseTo(3210, 2);
  });

  it("crosses the upper limit smoothly", () => {
    // Two pounds past the ceiling: 3015.36 + 0.04
    expect(th({ annual: 50270 }).nic).toBeCloseTo(3015.4, 2);
  });
});

describe("pension", () => {
  it("takes nothing when switched off", () => {
    expect(th({ pension: false }).pension).toBe(0);
    expect(th({ pension: false }).totalEarnings).toBe(60000);
  });

  it("takes the default 4% of gross", () => {
    const r = th({ pension: true });
    expect(r.pension).toBeCloseTo(2400, 2);
    expect(r.totalEarnings).toBeCloseTo(57600, 2);
  });

  it("honours a per-salary contribution rate", () => {
    expect(th({ pension: true, pensionRate: 0.08 }).pension).toBeCloseTo(4800, 2);
  });

  it("is taken before tax, so it reduces both PAYE and NI", () => {
    const without = th({ pension: false });
    const with4 = th({ pension: true });
    expect(with4.paye).toBeLessThan(without.paye);
    expect(with4.nic).toBeLessThan(without.nic);
    expect(with4.paye).toBeCloseTo(10471.4, 2);
    expect(with4.nic).toBeCloseTo(3162, 2);
  });

  it("is based on gross, not on the post-rise-and-tax figure", () => {
    // 4% of (50000 × 1.16)
    expect(th({ annual: 50000, increasePct: 0.16, pension: true }).pension).toBeCloseTo(2320, 2);
  });
});

describe("Vitality taxable benefit", () => {
  it("is zero when switched off", () => {
    expect(th({ vitality: false }).medTaxable).toBe(0);
  });

  it("is 3.1% of earnings after pension", () => {
    expect(th({ vitality: true }).medTaxable).toBeCloseTo(1860, 2);
    expect(th({ vitality: true, pension: true }).medTaxable).toBeCloseTo(1785.6, 2);
  });

  // The asymmetry is deliberate: the benefit is added to the PAYE base only.
  // A tidy-up that fed `totalEarnings + medTaxable` into both would quietly
  // overstate NI, so both halves are pinned here.
  it("raises PAYE but leaves NI untouched", () => {
    const off = th({ vitality: false });
    const on = th({ vitality: true });
    expect(on.nic).toBeCloseTo(off.nic, 2);
    expect(on.paye).toBeCloseTo(off.paye + 1860 * 0.4, 2); // taxed at the margin
  });

  it("does not change gross or total earnings", () => {
    const on = th({ vitality: true });
    expect(on.gross).toBe(60000);
    expect(on.totalEarnings).toBe(60000);
  });
});

describe("net", () => {
  it("is earnings less PAYE and NI", () => {
    const r = th({ annual: 60000 });
    expect(r.netAnnual).toBeCloseTo(r.totalEarnings - r.paye - r.nic, 6);
    expect(r.netAnnual).toBeCloseTo(45358.6, 2);
  });

  it("splits the annual figure into twelve", () => {
    const r = th({ annual: 60000 });
    expect(r.netMonthly).toBeCloseTo(r.netAnnual / 12, 6);
  });

  // End-to-end anchor: £60k with both toggles on, every field at once. If a
  // refactor moves any single line, this is the test that catches it.
  it("matches the full breakdown for £60k with Vitality and a 4% pension", () => {
    const r = takeHome({ annual: 60000, increasePct: 0, vitality: true, pension: true });
    expect(r.gross).toBe(60000);
    expect(r.pension).toBeCloseTo(2400, 2);
    expect(r.totalEarnings).toBeCloseTo(57600, 2);
    expect(r.medTaxable).toBeCloseTo(1785.6, 2);
    expect(r.paye).toBeCloseTo(11185.64, 2);
    expect(r.nic).toBeCloseTo(3162, 2);
    expect(r.netAnnual).toBeCloseTo(43252.36, 2);
    expect(r.netMonthly).toBeCloseTo(3604.36, 2);
  });
});
