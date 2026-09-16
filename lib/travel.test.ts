import { describe, expect, it } from "vitest";
import { fakeSql } from "./testSql";
import {
  TRAVEL_KEY,
  deleteTrip,
  deleteTripExpense,
  loadTravel,
  setTripPlanLine,
  upsertTrip,
  upsertTripExpense,
  upsertTripExpenses,
} from "./travel";

const trip = { name: "Lisbon", destination: "Portugal", start_date: "2026-10-01", end_date: "2026-10-05", currency: "eur", rate: 1.17, budget: 800 };

describe("travel store", () => {
  it("starts empty when nothing is stored", async () => {
    expect(await loadTravel(fakeSql())).toEqual({ trips: [], expenses: [] });
  });

  it("persists a new trip with an id, normalising the currency", async () => {
    const sql = fakeSql();
    await upsertTrip(sql, trip);
    const { trips } = await loadTravel(sql);
    expect(trips).toHaveLength(1);
    expect(trips[0].id).toMatch(/^[0-9a-f]{12}$/);
    expect(trips[0]).toMatchObject({ name: "Lisbon", currency: "EUR", rate: 1.17, budget: 800 });
  });

  it("forces a GBP trip's rate to 1 and swaps reversed dates", async () => {
    const sql = fakeSql();
    const { trips } = await upsertTrip(sql, { ...trip, currency: "GBP", rate: 3, start_date: "2026-10-05", end_date: "2026-10-01" });
    expect(trips[0]).toMatchObject({ rate: 1, currencies: [], start_date: "2026-10-01", end_date: "2026-10-05" });
  });

  it("stores several local currencies, cleaned, first one mirrored as the main", async () => {
    const sql = fakeSql();
    const { trips } = await upsertTrip(sql, {
      ...trip,
      currencies: [
        { code: "eur", rate: 1.17 }, { code: "CHF", rate: 1.07 }, { code: "GBP", rate: 1 },
        { code: "EUR", rate: 2 }, { code: "USD", rate: 0 }, { code: "TRY", rate: 50 }, { code: "AZN", rate: 2.3 }, { code: "JPY", rate: 190 },
      ],
    });
    expect(trips[0].currencies).toEqual([
      { code: "EUR", rate: 1.17 }, { code: "CHF", rate: 1.07 }, { code: "TRY", rate: 50 }, { code: "AZN", rate: 2.3 },
    ]);
    expect(trips[0]).toMatchObject({ currency: "EUR", rate: 1.17 });
  });

  it("pins older currency-less expenses before the trip's currencies change", async () => {
    // Saved before multi-currency: a EUR trip, one expense in euros, one in pounds.
    const sql = fakeSql({
      config: {
        travel_data: {
          trips: [{ id: "old", name: "Rome", currency: "EUR", rate: 1.2, budget: 0 }],
          expenses: [
            { id: "eur", trip_id: "old", amount: 12, in_gbp: false },
            { id: "gbp", trip_id: "old", amount: 50, in_gbp: true },
          ],
        },
      },
    });
    // Make CHF the only currency: EUR must be kept for the euro expense, which
    // must still mean euros rather than becoming the new main currency.
    const { trips, expenses } = await upsertTrip(sql, { id: "old", name: "Rome", currencies: [{ code: "CHF", rate: 1.1 }] });
    expect(trips[0].currencies).toEqual([{ code: "CHF", rate: 1.1 }, { code: "EUR", rate: 1.2 }]);
    expect(expenses.map((e) => [e.id, e.currency, e.in_gbp])).toEqual([["eur", "EUR", false], ["gbp", "GBP", true]]);
  });

  it("won't drop a currency the trip's expenses are recorded in", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, { ...trip, currencies: [{ code: "EUR", rate: 1.17 }, { code: "CHF", rate: 1.07 }] });
    await upsertTripExpense(sql, { trip_id: t.id, amount: 30, currency: "chf" });
    const { trips, expenses } = await upsertTrip(sql, { ...t, currencies: [{ code: "EUR", rate: 1.2 }] });
    expect(trips[0].currencies).toEqual([{ code: "EUR", rate: 1.2 }, { code: "CHF", rate: 1.07 }]);
    expect(expenses[0]).toMatchObject({ currency: "CHF", in_gbp: false });
  });

  it("updates a trip in place, keeping created_at", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    const { trips } = await upsertTrip(sql, { ...t, budget: 1000 });
    expect(trips).toHaveLength(1);
    expect(trips[0]).toMatchObject({ id: t.id, budget: 1000, created_at: t.created_at });
  });

  it("adds, edits and deletes an expense without touching the others", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await upsertTripExpense(sql, { trip_id: t.id, date: "2026-10-02", description: "Dinner", category: "Food & Drink", amount: 42.5 });
    const { expenses: [dinner] } = await upsertTripExpense(sql, { trip_id: t.id, date: "2026-10-01", description: "Flight", category: "Flights", amount: 180, in_gbp: true });
    await upsertTripExpense(sql, { ...dinner, amount: 45 });
    let data = await loadTravel(sql);
    expect(data.expenses.map((e) => [e.description, e.amount, e.in_gbp])).toEqual([["Dinner", 45, false], ["Flight", 180, true]]);

    data = await deleteTripExpense(sql, dinner.id);
    expect(data.expenses.map((e) => e.description)).toEqual(["Flight"]);
  });

  it("restores a deleted expense under its original id (undo)", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    const { expenses: [e] } = await upsertTripExpense(sql, { trip_id: t.id, date: "2026-10-02", description: "Taxi", category: "Transport", amount: 12 });
    await deleteTripExpense(sql, e.id);
    const { expenses } = await upsertTripExpense(sql, e);
    expect(expenses).toEqual([expect.objectContaining({ id: e.id, created_at: e.created_at, description: "Taxi" })]);
  });

  it("refuses expenses for unknown trips and coerces bad categories", async () => {
    const sql = fakeSql();
    await expect(upsertTripExpense(sql, { trip_id: "nope", amount: 1 })).rejects.toThrow(/Unknown trip/);
    const { trips: [t] } = await upsertTrip(sql, trip);
    const { expenses } = await upsertTripExpense(sql, { trip_id: t.id, category: "Casino", amount: -20 });
    expect(expenses[0]).toMatchObject({ category: "Other", amount: 20 });
  });

  it("deleting a trip drops only its expenses", async () => {
    const sql = fakeSql();
    const { trips: [a] } = await upsertTrip(sql, trip);
    const { trips: [, b] } = await upsertTrip(sql, { ...trip, name: "Baku" });
    await upsertTripExpense(sql, { trip_id: a.id, amount: 1 });
    await upsertTripExpense(sql, { trip_id: b.id, amount: 2 });
    const data = await deleteTrip(sql, a.id);
    expect(data.trips.map((t) => t.name)).toEqual(["Baku"]);
    expect(data.expenses.map((e) => e.trip_id)).toEqual([b.id]);
  });

  it("keeps both of two writes that race each other", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    // Both read the same version before either writes; the loser must replay.
    await Promise.all([
      upsertTripExpense(sql, { trip_id: t.id, description: "Phone", amount: 1 }),
      upsertTripExpense(sql, { trip_id: t.id, description: "Laptop", amount: 2 }),
      upsertTrip(sql, { ...t, budget: 950 }),
    ]);
    const data = await loadTravel(sql);
    expect(data.expenses.map((e) => e.description).sort()).toEqual(["Laptop", "Phone"]);
    expect(data.trips[0].budget).toBe(950);
  });

  it("saving the same new expense twice (double-click) stores it once", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    const e = { id: "client1", trip_id: t.id, description: "Coffee", amount: 3 };
    await Promise.all([upsertTripExpense(sql, e), upsertTripExpense(sql, e)]);
    expect((await loadTravel(sql)).expenses).toHaveLength(1);
  });

  it("links a batch of bank transactions in one go, and keeps the link through edits", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await upsertTripExpenses(sql, [
      { id: "a1", trip_id: t.id, amount: 120, in_gbp: true, tx_ref: "monzo:A", category: "Flights" },
      { id: "b1", trip_id: t.id, amount: 30, in_gbp: true, tx_ref: "amex:B" },
    ]);
    // Re-linking the same transaction under a fresh id updates, doesn't duplicate.
    await upsertTripExpenses(sql, [{ id: "a2", trip_id: t.id, amount: 120, in_gbp: true, tx_ref: "monzo:A", category: "Transport" }]);
    // An edit from the dialog doesn't send tx_ref; the link must survive it.
    const { expenses } = await upsertTripExpense(sql, { id: "b1", trip_id: t.id, amount: 15, in_gbp: true, category: "Food & Drink" });
    expect(expenses).toHaveLength(2);
    expect(expenses.find((e) => e.tx_ref === "monzo:A")).toMatchObject({ id: "a1", category: "Transport" });
    expect(expenses.find((e) => e.id === "b1")).toMatchObject({ amount: 15, tx_ref: "amex:B", category: "Food & Drink" });
  });

  it("keeps a linked expense as a copy, independent of the transaction it came from", async () => {
    // No bank or Flex rows exist in this fake at all: the stored expense must
    // still read back whole, because nothing resolves tx_ref against them.
    const sql = fakeSql({ transactions: [] });
    await upsertTrip(sql, { ...trip, id: "A" });
    await upsertTripExpenses(sql, [
      { id: "ba", trip_id: "A", tx_ref: "flex:tx_0000B9brREl7h4s9tBc3jn", amount: 47.56, currency: "GBP", date: "2026-08-21", description: "BRITISH AIRWAYS PLC LONDON GBR", category: "Flights" },
    ]);
    expect((await loadTravel(sql)).expenses[0]).toMatchObject({
      amount: 47.56, date: "2026-08-21", description: "BRITISH AIRWAYS PLC LONDON GBR", category: "Flights", currency: "GBP",
    });
  });

  it("refuses to link one transaction to two trips", async () => {
    const sql = fakeSql();
    const { trips: [a] } = await upsertTrip(sql, { ...trip, id: "A", name: "Lisbon" });
    await upsertTrip(sql, { ...trip, id: "B", name: "Baku" });
    await upsertTripExpenses(sql, [{ trip_id: "A", amount: 5, tx_ref: "monzo:X" }]);
    await expect(upsertTripExpenses(sql, [{ trip_id: "B", amount: 5, tx_ref: "monzo:X" }])).rejects.toThrow(/already linked to Lisbon/);
    expect((await loadTravel(sql)).expenses.map((e) => e.trip_id)).toEqual([a.id]);
  });

  it("undo restores only what is still absent", async () => {
    const sql = fakeSql();
    await upsertTrip(sql, { ...trip, id: "A" });
    await upsertTrip(sql, { ...trip, id: "B" });
    const { expenses: [linked] } = await upsertTripExpenses(sql, [{ id: "e1", trip_id: "A", amount: 5, tx_ref: "monzo:X" }]);
    // Unlink from A, link the same transaction to B, then hit Undo on the A unlink.
    await deleteTripExpense(sql, linked.id);
    await upsertTripExpenses(sql, [{ id: "e2", trip_id: "B", amount: 5, tx_ref: "monzo:X" }]);
    await upsertTripExpenses(sql, [linked], { restore: true });
    expect((await loadTravel(sql)).expenses.map((e) => [e.id, e.trip_id])).toEqual([["e2", "B"]]);

    // A plain deleted expense does come back, and one for a deleted trip doesn't.
    const { expenses } = await upsertTripExpense(sql, { id: "e3", trip_id: "A", amount: 7 });
    const e3 = expenses.find((e) => e.id === "e3")!;
    await deleteTripExpense(sql, "e3");
    await upsertTripExpenses(sql, [e3, { id: "e4", trip_id: "gone", amount: 1 }], { restore: true });
    expect((await loadTravel(sql)).expenses.map((e) => e.id).sort()).toEqual(["e2", "e3"]);
  });

  it("rejects the whole batch if any expense points at a missing trip", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await expect(
      upsertTripExpenses(sql, [{ trip_id: t.id, amount: 1 }, { trip_id: "gone", amount: 2 }]),
    ).rejects.toThrow(/Unknown trip/);
    expect((await loadTravel(sql)).expenses).toHaveLength(0);
  });

  it("stores a split, clamps it, and keeps it through edits that don't mention it", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await upsertTripExpense(sql, { id: "bnb", trip_id: t.id, amount: 540, split: 3 });
    await upsertTripExpenses(sql, [{ id: "x", trip_id: t.id, amount: 1, split: 99 }, { id: "y", trip_id: t.id, amount: 1, split: 0 }]);
    // An older client (or a caller that doesn't split) leaves the split alone.
    const { expenses } = await upsertTripExpense(sql, { id: "bnb", trip_id: t.id, amount: 600 });
    expect(expenses.map((e) => [e.id, e.amount, e.split])).toEqual([["bnb", 600, 3], ["x", 1, 20], ["y", 1, 1]]);
  });

  it("plans per category, one line at a time, without the trip dialog wiping it", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await Promise.all([
      setTripPlanLine(sql, t.id, { category: "Food & Drink", amount: 40, per_day: true }),
      setTripPlanLine(sql, t.id, { category: "Flights", amount: 200, per_day: false }),
    ]);
    await setTripPlanLine(sql, t.id, { category: "Transport", amount: 10, per_day: true });
    await setTripPlanLine(sql, t.id, { category: "Transport", amount: 0 });
    // Saving the trip's details (no plan sent) keeps the plan.
    const { trips } = await upsertTrip(sql, { ...t, plan: undefined, budget: 1200 });
    expect(trips[0].plan).toEqual({ "Food & Drink": { amount: 40, per_day: true }, Flights: { amount: 200, per_day: false } });
    await expect(setTripPlanLine(sql, t.id, { category: "Casino", amount: 5 })).rejects.toThrow(/Unknown category/);
  });

  it("stores how a manual expense was paid, ignoring anything but card or flex", async () => {
    const sql = fakeSql();
    const { trips: [t] } = await upsertTrip(sql, trip);
    await upsertTripExpenses(sql, [
      { id: "a", trip_id: t.id, amount: 1, paid_with: "flex" },
      { id: "b", trip_id: t.id, amount: 1, paid_with: "cash" },
    ]);
    const { expenses } = await upsertTripExpense(sql, { id: "a", trip_id: t.id, amount: 2 });
    expect(expenses.map((e) => e.paid_with)).toEqual(["flex", undefined]);
  });

  it("stores under its own key, leaving other config alone", async () => {
    const config: Record<string, unknown> = { notes: [{ id: "n1" }] };
    await upsertTrip(fakeSql({ config }), trip);
    expect(Object.keys(config).sort()).toEqual(["notes", TRAVEL_KEY]);
    expect(config.notes).toEqual([{ id: "n1" }]);
  });
});
