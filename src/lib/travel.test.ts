import { describe, expect, it } from "vitest";
import type { Trip, TripExpense } from "../types/travel";
import { flexSchedule, paidWith, displayMoney, expenseCurrency, planRows, shareGbp, daysElapsed, defaultTrip, formatTripDates, flexAsTransaction, linkCandidates, linkWindow, monthsBetween, summarize, toGbp, tripDays, tripStatus } from "./travel";

const trip = (over: Partial<Trip> = {}): Trip => ({
  id: "t1", name: "Lisbon", destination: "", start_date: "2026-10-01", end_date: "2026-10-05",
  currency: "EUR", rate: 1.25, budget: 0, created_at: "2026-09-01T00:00:00Z", updated_at: "", ...over,
});
const exp = (over: Partial<TripExpense>): TripExpense => ({
  id: "e", trip_id: "t1", date: "2026-10-02", description: "", category: "Other", amount: 0,
  in_gbp: false, created_at: "", updated_at: "", ...over,
});

describe("travel maths", () => {
  it("converts local amounts at the trip rate, leaves pounds alone", () => {
    expect(toGbp(exp({ amount: 50 }), trip())).toBe(40);
    expect(toGbp(exp({ amount: 50, in_gbp: true }), trip())).toBe(50);
    expect(toGbp(exp({ amount: 50 }), trip({ currency: "GBP", rate: 1.25 }))).toBe(50);
  });

  it("counts trip days inclusively, across a month end", () => {
    expect(tripDays(trip())).toBe(5);
    expect(tripDays(trip({ start_date: "2026-10-30", end_date: "2026-11-02" }))).toBe(4);
    expect(tripDays(trip({ end_date: "" }))).toBe(0);
  });

  it("converts each expense at its own currency's rate, older trips and expenses included", () => {
    const multi = trip({ currencies: [{ code: "EUR", rate: 1.25 }, { code: "CHF", rate: 1.1 }] });
    expect(toGbp(exp({ amount: 55, currency: "CHF" }), multi)).toBeCloseTo(50);
    expect(toGbp(exp({ amount: 50, currency: "EUR" }), multi)).toBe(40);
    expect(toGbp(exp({ amount: 50, currency: "GBP" }), multi)).toBe(50);
    // No currency on the expense: in_gbp decides, else the main local currency.
    expect(expenseCurrency(exp({ in_gbp: false }), multi)).toBe("EUR");
    expect(expenseCurrency(exp({ in_gbp: true }), multi)).toBe("GBP");
    // A pre-multi-currency trip still reads its single currency.
    expect(expenseCurrency(exp({}), trip())).toBe("EUR");
    expect(displayMoney(40, multi, "CHF")).toMatch(/44/);
    expect(displayMoney(40, multi, "GBP")).toBe("£40");
  });

  it("counts only your share of split expenses, and what others owe back", () => {
    expect(shareGbp(exp({ amount: 540, in_gbp: true, split: 3 }), trip())).toBe(180);
    const s = summarize(trip(), [
      exp({ category: "Accommodation", amount: 540, in_gbp: true, split: 3 }),
      exp({ category: "Food & Drink", amount: 50 }),
    ], "2026-10-01");
    expect(s.total).toBe(220);
    expect(s.owed).toBe(360);
    expect(s.byCategory).toEqual([{ category: "Accommodation", total: 180 }, { category: "Food & Drink", total: 40 }]);
  });

  it("plans per day across the trip's days, or once", () => {
    const t = trip({ plan: { "Food & Drink": { amount: 40, per_day: true }, Flights: { amount: 200, per_day: false } } });
    const s = summarize(t, [exp({ category: "Food & Drink", amount: 100 })], "2026-10-01");
    const { rows, planned } = planRows(t, s);
    expect(rows.find((r) => r.category === "Food & Drink")).toMatchObject({ planned: 200, spent: 80, per_day: true });
    expect(rows.find((r) => r.category === "Flights")).toMatchObject({ planned: 200, spent: 0, per_day: false });
    // Unplanned rows default to per day for day-to-day categories, once for stays.
    expect(rows.find((r) => r.category === "Transport")).toMatchObject({ planned: 0, per_day: true });
    expect(rows.find((r) => r.category === "Accommodation")?.per_day).toBe(false);
    expect(planned).toBe(400);
  });

  it("expects plan plus spend elsewhere, without double-counting planned categories", () => {
    // Food planned £200, £80 spent; flights spent £100 but never planned.
    const t = trip({ plan: { "Food & Drink": { amount: 40, per_day: true } } });
    const s = summarize(t, [
      exp({ category: "Food & Drink", amount: 100 }),
      exp({ category: "Flights", amount: 100, in_gbp: true }),
    ], "2026-10-01");
    expect(planRows(t, s)).toMatchObject({ planned: 200, spent: 180, expected: 300 });
  });

  it("splits your share between card and Flex, and schedules Flex repayments by month", () => {
    const t = trip({ currency: "GBP", rate: 1 });
    const ba = exp({ id: "ba", tx_ref: "flex:tx_ba", amount: 48, in_gbp: true, split: 2 });
    const bnb = exp({ id: "bnb", tx_ref: "amex:9", amount: 300, in_gbp: true });
    const byHand = exp({ id: "hand", amount: 30, in_gbp: true, paid_with: "flex" });
    expect([ba, bnb, byHand].map(paidWith)).toEqual(["flex", "card", "flex"]);
    expect(summarize(t, [ba, bnb, byHand], "2026-10-01").byPayment).toEqual({ card: 300, flex: 54 });

    const sched = flexSchedule(t, [ba, bnb, byHand], [{
      flex_id: "tx_ba", amount: -48,
      repayment_1_date: "2026-10-01T00:00:00", repayment_1_amount: -16,
      repayment_2_date: "2026-11-01T00:00:00", repayment_2_amount: -16,
      repayment_3_date: "2026-12-01T00:00:00", repayment_3_amount: -16,
    }]);
    // Split between two: half of each £16 repayment is yours.
    expect(sched).toEqual({
      months: [{ month: "2026-10", amount: 8 }, { month: "2026-11", amount: 8 }, { month: "2026-12", amount: 8 }],
      unscheduled: 30,
    });
    // Once the repayment row is gone, the expense still counts — just unscheduled.
    expect(flexSchedule(t, [ba], [])).toEqual({ months: [], unscheduled: 24 });
  });

  it("knows where today sits relative to the trip", () => {
    expect(tripStatus(trip(), "2026-09-30")).toBe("upcoming");
    expect(tripStatus(trip(), "2026-10-05")).toBe("ongoing");
    expect(tripStatus(trip(), "2026-10-06")).toBe("past");
    expect(daysElapsed(trip(), "2026-10-03")).toBe(3);
    expect(daysElapsed(trip(), "2026-12-01")).toBe(5);
    expect(daysElapsed(trip(), "2026-01-01")).toBe(0);
  });

  it("summarises: prepaid out of per-day, categories ranked", () => {
    const s = summarize(
      trip(),
      [
        exp({ category: "Flights", amount: 200, in_gbp: true, date: "2026-08-01" }),
        exp({ category: "Food & Drink", amount: 50, date: "2026-10-01" }),
        exp({ category: "Transport", amount: 25, date: "2026-10-01" }),
        exp({ category: "Food & Drink", amount: 25, date: "2026-10-03" }),
      ],
      "2026-10-02",
    );
    expect(s.total).toBe(280);
    expect(s.prepaid).toBe(200);
    expect(s.dayToDay).toBe(80);
    expect(s.perDay).toBe(40); // 2 days elapsed
    expect(s.byCategory.map((c) => c.category)).toEqual(["Flights", "Food & Drink", "Transport"]);
  });

  it("opens the ongoing trip, else the next, else the latest", () => {
    const past = trip({ id: "past", start_date: "2026-01-01", end_date: "2026-01-05" });
    const soon = trip({ id: "soon", start_date: "2026-11-01", end_date: "2026-11-05" });
    const later = trip({ id: "later", start_date: "2027-01-01", end_date: "2027-01-05" });
    expect(defaultTrip([past, later, soon], "2026-09-16")?.id).toBe("soon");
    expect(defaultTrip([past, soon], "2026-11-02")?.id).toBe("soon");
    expect(defaultTrip([past], "2026-09-16")?.id).toBe("past");
  });

  it("formats date ranges compactly", () => {
    expect(formatTripDates(trip())).toBe("1 Oct – 5 Oct 2026");
    expect(formatTripDates(trip({ start_date: "2026-12-30", end_date: "2027-01-02" }))).toBe("30 Dec 2026 – 2 Jan 2027");
  });
});

describe("linking bank transactions", () => {
  const tx = (over: Record<string, any>) => ({
    source: "monzo", id: "f", created: "2026-10-02T12:00:00", description: "SHOP", merchant_name: null,
    amount: -10, category: "Other", subcategory: "Other", ...over,
  });

  it("spans every month of the search window", () => {
    expect(monthsBetween("2026-07-03", "2026-10-12")).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(monthsBetween("2026-12-20", "2027-01-05")).toEqual(["2026-12", "2027-01"]);
    expect(linkWindow(trip({ start_date: "" }))).toBeNull();
  });

  it("suggests Travel-categorised and during-trip spend, skips refunds and out-of-window rows", () => {
    const c = linkCandidates(
      trip(),
      [
        tx({ id: "flight", created: "2026-07-20T09:00:00", description: "BRITISH AIRWAYS", category: "Travel", amount: -180 }),
        tx({ id: "coffee", created: "2026-10-02T09:00:00", subcategory: "Coffee" }),
        tx({ id: "gym", created: "2026-09-15T09:00:00" }),
        tx({ id: "refund", created: "2026-10-02T09:00:00", amount: 20 }),
        tx({ id: "ancient", created: "2026-05-01T09:00:00", category: "Travel" }),
        tx({ id: "energy", created: "2026-10-03T09:00:00", category: "Rent & Utilities" }),
      ],
      [exp({ tx_ref: "monzo:coffee" }), exp({ trip_id: "other", tx_ref: "monzo:gym" })],
    );
    expect(c.map((x) => [x.ref, x.reason, x.linkedTripId])).toEqual([
      ["monzo:coffee", "during", "t1"],
      ["monzo:flight", "travel", null],
      ["monzo:energy", null, null],
      ["monzo:gym", null, "other"],
    ]);
    expect(c.find((x) => x.ref === "monzo:flight")).toMatchObject({ amount: 180, guess: "Flights" });
    expect(c.find((x) => x.ref === "monzo:coffee")?.guess).toBe("Food & Drink");
  });

  it("includes Flex purchases, suggesting flights by merchant, skipping refunds", () => {
    const flex = (over: Record<string, any>) =>
      flexAsTransaction({ flex_id: "tx_1", created: "2026-08-21T20:25:03.984Z", description: "X", amount: -10, refunded: false, ...over });
    const rows = [
      flex({ flex_id: "ba", description: "BRITISH AIRWAYS PLC    LONDON        GBR", amount: -47.56 }),
      flex({ flex_id: "amz", description: "AMAZON.CO.UK   LONDON  GBR" }),
      flex({ flex_id: "back", refunded: true }),
    ].filter((r) => r !== null);
    const c = linkCandidates(trip(), rows, []);
    expect(c.map((x) => [x.ref, x.reason])).toEqual([["flex:ba", "travel"], ["flex:amz", null]]);
    expect(c[0]).toMatchObject({ source: "flex", description: "BRITISH AIRWAYS PLC LONDON GBR", amount: 47.56, guess: "Flights", date: "2026-08-21" });
  });

  it("tells apart banks that reuse the same row id", () => {
    const c = linkCandidates(trip(), [tx({ source: "monzo", id: "1" }), tx({ source: "amex", id: "1" })], []);
    expect(c.map((x) => x.ref).sort()).toEqual(["amex:1", "monzo:1"]);
  });
});
