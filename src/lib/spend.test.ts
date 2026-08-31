import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "../types/transaction";
import { MAIN_CATEGORIES, RENT_UTILITY_CATEGORY } from "../types/categories";
import { dailySpendSeries, spendByCategory, totalSpend } from "./spend";

const tx = (
  created: string,
  amount: number,
  category: string,
  over: Partial<Transaction> = {},
): Transaction => ({
  id: created + amount,
  flag_id: "f",
  created,
  description: "d",
  amount,
  currency: "GBP",
  merchant_name: null,
  status: "booked",
  source: "monzo",
  subcategory: "",
  category,
  notes: "",
  one_time: false,
  overridden: false,
  ...over,
});

// Every test runs at 10 Aug 2026, so "2026-08" is the current month (day 10)
// and "2026-06" is safely in the past.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 10, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe("spendByCategory", () => {
  it("reports spending as a positive number", () => {
    const totals = spendByCategory([tx("2026-08-02", -50, "Groceries")]);
    expect(totals.Groceries).toBe(50);
  });

  it("nets refunds against spending in the same category", () => {
    const totals = spendByCategory([
      tx("2026-08-02", -50, "Groceries"),
      tx("2026-08-03", 20, "Groceries"),
    ]);
    expect(totals.Groceries).toBe(30);
  });

  it("floors an over-refunded category at zero rather than going negative", () => {
    const totals = spendByCategory([
      tx("2026-08-02", -50, "Groceries"),
      tx("2026-08-03", 80, "Groceries"),
    ]);
    expect(totals.Groceries).toBe(0);
  });

  it("excludes Uncategorized", () => {
    const totals = spendByCategory([tx("2026-08-02", -50, "Uncategorized")]);
    expect(totals.Uncategorized).toBeUndefined();
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });

  it("excludes Rent & Utilities — the Rent tab tracks those separately", () => {
    const totals = spendByCategory([tx("2026-08-02", -1900, RENT_UTILITY_CATEGORY)]);
    expect(Object.values(totals).every((v) => v === 0)).toBe(true);
  });

  it("returns a zero for every main category, not just the ones with spend", () => {
    const totals = spendByCategory([tx("2026-08-02", -50, "Groceries")]);
    expect(Object.keys(totals).sort()).toEqual([...MAIN_CATEGORIES].sort());
    expect(totals.Travel).toBe(0);
  });

  it("counts one-time transactions that carry a real category", () => {
    const totals = spendByCategory([tx("2026-08-02", -50, "Shopping", { one_time: true })]);
    expect(totals.Shopping).toBe(50);
  });
});

describe("totalSpend", () => {
  it("sums across categories and nets refunds", () => {
    expect(
      totalSpend([
        tx("2026-08-02", -50, "Groceries"),
        tx("2026-08-03", -30, "Lunch"),
        tx("2026-08-04", 10, "Groceries"),
      ]),
    ).toBe(70);
  });

  it("excludes Uncategorized and Rent & Utilities", () => {
    expect(
      totalSpend([
        tx("2026-08-02", -50, "Groceries"),
        tx("2026-08-03", -999, "Uncategorized"),
        tx("2026-08-04", -1900, RENT_UTILITY_CATEGORY),
      ]),
    ).toBe(50);
  });

  it("is zero when refunds outweigh spending overall", () => {
    expect(
      totalSpend([tx("2026-08-02", -50, "Groceries"), tx("2026-08-03", 80, "Groceries")]),
    ).toBe(0);
  });

  // Documents a real divergence: `isExcluded` only drops Uncategorized and
  // Rent & Utilities, but spendByCategory reads out MAIN_CATEGORIES only. A
  // category outside that list therefore reaches the total but no card.
  it("counts a non-main category that spendByCategory drops", () => {
    const rows = [tx("2026-08-02", -50, "Savings")];
    expect(totalSpend(rows)).toBe(50);
    expect(Object.values(spendByCategory(rows)).every((v) => v === 0)).toBe(true);
  });
});

describe("dailySpendSeries — pace line", () => {
  it("starts day 1 at the baseline and ends the month on the budget", () => {
    const s = dailySpendSeries([], "2026-08", 1500, 300);
    expect(s[0].pace).toBe(300);
    expect(s[s.length - 1].pace).toBe(1500);
  });

  it("starts at zero when there is no baseline", () => {
    const s = dailySpendSeries([], "2026-06", 1500);
    expect(s[0].pace).toBe(0);
    expect(s[s.length - 1].pace).toBe(1500);
  });

  it("rises monotonically", () => {
    const s = dailySpendSeries([], "2026-08", 1500, 300);
    for (let i = 1; i < s.length; i++) expect(s[i].pace).toBeGreaterThan(s[i - 1].pace);
  });

  it("clamps a baseline above the budget, giving a flat line", () => {
    const s = dailySpendSeries([], "2026-08", 1000, 5000);
    expect(s[0].pace).toBe(1000);
    expect(s[s.length - 1].pace).toBe(1000);
  });

  it("treats a negative baseline as zero", () => {
    const s = dailySpendSeries([], "2026-08", 1500, -400);
    expect(s[0].pace).toBe(0);
  });

  it("is flat at zero when no budget is set", () => {
    const s = dailySpendSeries([], "2026-08", 0, 300);
    expect(s.every((p) => p.pace === 0)).toBe(true);
  });
});

describe("dailySpendSeries — month length", () => {
  it("covers 28 days in a non-leap February", () => {
    expect(dailySpendSeries([], "2027-02", 1000)).toHaveLength(28);
  });

  it("covers 29 days in a leap February", () => {
    expect(dailySpendSeries([], "2028-02", 1000)).toHaveLength(29);
  });

  it("covers 30 days in April and 31 in August", () => {
    expect(dailySpendSeries([], "2026-04", 1000)).toHaveLength(30);
    expect(dailySpendSeries([], "2026-08", 1000)).toHaveLength(31);
  });

  it("numbers days from 1 and zero-pads the dates", () => {
    const s = dailySpendSeries([], "2026-06", 1000);
    expect(s[0]).toMatchObject({ day: 1, date: "2026-06-01" });
    expect(s[29]).toMatchObject({ day: 30, date: "2026-06-30" });
  });
});

describe("dailySpendSeries — cumulative spend in a past month", () => {
  const rows = [
    tx("2026-06-02T10:00:00", -100, "Groceries"),
    tx("2026-06-05T10:00:00", -50, "Lunch"),
    tx("2026-06-05T18:00:00", -25, "Lunch"),
  ];

  it("accumulates across the month and holds the total to the last day", () => {
    const s = dailySpendSeries(rows, "2026-06", 1000);
    expect(s[1].cumulative).toBe(100); // 2 June
    expect(s[4].cumulative).toBe(175); // 5 June, both rows
    expect(s[29].cumulative).toBe(175); // 30 June
  });

  it("leaves days before the first transaction at zero", () => {
    expect(dailySpendSeries(rows, "2026-06", 1000)[0].cumulative).toBe(0);
  });

  it("never nulls a day, and never projects", () => {
    const s = dailySpendSeries(rows, "2026-06", 1000);
    expect(s.every((p) => p.cumulative !== null)).toBe(true);
    expect(s.every((p) => p.projection === null)).toBe(true);
  });

  it("lets a refund pull the running total back down", () => {
    const s = dailySpendSeries(
      [...rows, tx("2026-06-10T10:00:00", 75, "Groceries")],
      "2026-06",
      1000,
    );
    expect(s[4].cumulative).toBe(175);
    expect(s[9].cumulative).toBe(100);
  });

  it("floors the running total at zero when refunds run ahead of spend", () => {
    const s = dailySpendSeries(
      [tx("2026-06-02", -50, "Groceries"), tx("2026-06-03", 200, "Groceries")],
      "2026-06",
      1000,
    );
    expect(s[2].cumulative).toBe(0);
  });

  it("excludes Uncategorized and Rent & Utilities from the curve", () => {
    const s = dailySpendSeries(
      [
        tx("2026-06-02", -100, "Groceries"),
        tx("2026-06-02", -999, "Uncategorized"),
        tx("2026-06-02", -1900, RENT_UTILITY_CATEGORY),
      ],
      "2026-06",
      1000,
    );
    expect(s[1].cumulative).toBe(100);
  });
});

describe("dailySpendSeries — current month", () => {
  // Nine ordinary days plus one blow-out, ending on today (the 10th).
  const ordinary = Array.from({ length: 9 }, (_, i) =>
    tx(`2026-08-${String(i + 1).padStart(2, "0")}T10:00:00`, -10, "Lunch"),
  );
  const blowout = tx("2026-08-10T10:00:00", -500, "Shopping");

  it("stops the actual line at today and nulls the rest of the month", () => {
    const s = dailySpendSeries(ordinary, "2026-08", 1500);
    expect(s[9].cumulative).toBe(90); // day 10
    expect(s[10].cumulative).toBeNull(); // day 11
    expect(s[30].cumulative).toBeNull(); // day 31
  });

  it("anchors the projection at today's actual total", () => {
    const s = dailySpendSeries([...ordinary, blowout], "2026-08", 1500);
    expect(s[9].projection).toBe(590);
  });

  it("extrapolates forward at the trimmed daily rate", () => {
    // Median non-zero day is £10, so the threshold is £30 and the £500 day is
    // dropped from the rate: £90 over 10 days = £9/day.
    const s = dailySpendSeries([...ordinary, blowout], "2026-08", 1500);
    expect(s[10].projection).toBe(599); // 590 + 9
    expect(s[30].projection).toBe(779); // 590 + 9 × 21
  });

  it("keeps the outlier in the actual total even though the rate ignores it", () => {
    const s = dailySpendSeries([...ordinary, blowout], "2026-08", 1500);
    expect(s[9].cumulative).toBe(590);
  });

  it("uses the full rate when no day is an outlier", () => {
    const flat = Array.from({ length: 10 }, (_, i) =>
      tx(`2026-08-${String(i + 1).padStart(2, "0")}T10:00:00`, -10, "Lunch"),
    );
    const s = dailySpendSeries(flat, "2026-08", 1500);
    expect(s[9].projection).toBe(100);
    expect(s[10].projection).toBe(110); // 100 + 10
  });

  it("leaves past days unprojected", () => {
    const s = dailySpendSeries(ordinary, "2026-08", 1500);
    expect(s.slice(0, 9).every((p) => p.projection === null)).toBe(true);
  });

  it("suppresses the projection before day 4", () => {
    vi.setSystemTime(new Date(2026, 7, 3, 12, 0, 0));
    const s = dailySpendSeries(ordinary.slice(0, 3), "2026-08", 1500);
    expect(s.every((p) => p.projection === null)).toBe(true);
  });

  it("starts projecting on day 4", () => {
    vi.setSystemTime(new Date(2026, 7, 4, 12, 0, 0));
    const s = dailySpendSeries(ordinary.slice(0, 4), "2026-08", 1500);
    expect(s[3].projection).toBe(40);
    expect(s[4].projection).toBe(50); // 40 + 10/day
  });

  it("does not project a month with no spend at all", () => {
    const s = dailySpendSeries([], "2026-08", 1500);
    expect(s.every((p) => p.projection === null)).toBe(true);
  });
});
