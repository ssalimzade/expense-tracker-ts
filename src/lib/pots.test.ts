import { describe, expect, it } from "vitest";
import type { RentData, RentLineItem, RentPotSettlement } from "../types/rent";
import { isRetired, potInflow, potsTotal, potViews } from "./pots";

const POT = "hot_water";

/** One saved item, plus a non-saved one so the `saved` filter has something to drop. */
const build = (
  months: Record<string, RentLineItem>,
  settlements: RentPotSettlement[] = [],
): RentData => ({
  items: [
    { key: "flat", label: "Rent", saved: false },
    { key: POT, label: "Hot Water", saved: true },
  ],
  months: Object.fromEntries(Object.entries(months).map(([m, cell]) => [m, { [POT]: cell }])),
  pots: settlements.length ? { [POT]: { settlements } } : undefined,
});

const paid = (amount: number): RentLineItem => ({ amount, paid: true });
const unpaid = (amount: number): RentLineItem => ({ amount, paid: false });
const view = (data: RentData, upTo: string) => potViews(data, upTo)[0];

describe("potInflow", () => {
  it("is zero for a month that is allocated but not yet paid", () => {
    expect(potInflow(build({ "2026-01": unpaid(50) }), POT, "2026-01")).toBe(0);
  });

  it("is the allocation once the money moves", () => {
    expect(potInflow(build({ "2026-01": paid(50) }), POT, "2026-01")).toBe(50);
  });

  it("accrues the share, not the bill, when someone else part-covers it", () => {
    const data = build({ "2026-01": { amount: 50, paid: true, contribution: 20 } });
    expect(potInflow(data, POT, "2026-01")).toBe(30);
  });

  it("is zero for a month with no entry at all", () => {
    expect(potInflow(build({}), POT, "2026-01")).toBe(0);
  });
});

describe("potViews — accrual", () => {
  it("returns one view per saved item only", () => {
    const views = potViews(build({ "2026-01": paid(50) }), "2026-01");
    expect(views.map((v) => v.key)).toEqual([POT]);
  });

  it("sums paid months into the balance", () => {
    const data = build({ "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) });
    expect(view(data, "2026-03").balance).toBe(150);
  });

  it("ignores unpaid months", () => {
    const data = build({ "2026-01": paid(50), "2026-02": unpaid(50), "2026-03": paid(50) });
    expect(view(data, "2026-03").balance).toBe(100);
  });

  it("bounds the balance at upTo, so future allocations do not inflate it", () => {
    const data = build({
      "2026-01": paid(50),
      "2026-02": paid(50),
      "2026-03": paid(50),
      "2026-04": paid(50),
    });
    expect(view(data, "2026-02").balance).toBe(100);
  });

  it("is not closed while it has never been settled", () => {
    const data = build({ "2026-01": paid(50) });
    expect(view(data, "2026-01")).toMatchObject({ closed: false, lastSettled: undefined });
  });
});

describe("potViews — settlement", () => {
  it("banks the accrued balance and resets the pot to zero", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) },
      [{ month: "2026-03", bill: 120 }],
    );
    const v = view(data, "2026-03");
    expect(v.settlements).toEqual([
      { month: "2026-03", bill: 120, accrued: 150, diff: 30 },
    ]);
    expect(v.balance).toBe(0);
    expect(v.closed).toBe(true);
  });

  it("reports a shortfall as a negative diff", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) },
      [{ month: "2026-03", bill: 200 }],
    );
    expect(view(data, "2026-03").settlements[0]).toMatchObject({ accrued: 150, diff: -50 });
  });

  it("starts accruing again after the settlement", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50), "2026-04": paid(50) },
      [{ month: "2026-02", bill: 100 }],
    );
    const v = view(data, "2026-04");
    expect(v.settlements[0]).toMatchObject({ accrued: 100, diff: 0 });
    expect(v.balance).toBe(100); // March + April, not January onward
    expect(v.closed).toBe(false); // money has gone in since
    expect(v.lastSettled).toBe("2026-02");
  });

  it("partitions the timeline across several settlements", () => {
    const data = build(
      {
        "2026-01": paid(50),
        "2026-02": paid(50),
        "2026-03": paid(50),
        "2026-04": paid(50),
      },
      [
        { month: "2026-02", bill: 90 },
        { month: "2026-04", bill: 80 },
      ],
    );
    const v = view(data, "2026-04");
    expect(v.settlements).toEqual([
      { month: "2026-02", bill: 90, accrued: 100, diff: 10 },
      { month: "2026-04", bill: 80, accrued: 100, diff: 20 },
    ]);
    expect(v.balance).toBe(0);
  });

  it("sorts settlements before walking, so input order does not matter", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) },
      [
        { month: "2026-03", bill: 100 },
        { month: "2026-01", bill: 40 },
      ],
    );
    const v = view(data, "2026-03");
    expect(v.settlements.map((s) => s.month)).toEqual(["2026-01", "2026-03"]);
    expect(v.settlements[0]).toMatchObject({ accrued: 50, diff: 10 });
    expect(v.settlements[1]).toMatchObject({ accrued: 100, diff: 0 });
  });

  it("gives a second settlement in the same month an empty pot", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50) },
      [
        { month: "2026-02", bill: 40 },
        { month: "2026-02", bill: 10 },
      ],
    );
    const v = view(data, "2026-02");
    expect(v.settlements[0]).toMatchObject({ accrued: 100, diff: 60 });
    expect(v.settlements[1]).toMatchObject({ accrued: 0, diff: -10 });
  });

  it("closes the pot on a settlement dated past the last known month", () => {
    // Nothing in `months` reaches 2026-02, so only the trailing pass can apply it.
    const data = build({ "2026-01": paid(50) }, [{ month: "2026-02", bill: 40 }]);
    const v = view(data, "2026-03");
    expect(v.settlements).toEqual([
      { month: "2026-02", bill: 40, accrued: 50, diff: 10 },
    ]);
    expect(v.balance).toBe(0);
    expect(v.closed).toBe(true);
  });

  it("leaves a settlement dated after upTo unapplied", () => {
    const data = build({ "2026-01": paid(50) }, [{ month: "2026-02", bill: 40 }]);
    const v = view(data, "2026-01");
    expect(v.settlements).toEqual([]);
    expect(v.balance).toBe(50);
    expect(v.closed).toBe(false);
  });
});

describe("potsTotal", () => {
  it("sums the live balances", () => {
    const data: RentData = {
      items: [
        { key: "a", label: "A", saved: true },
        { key: "b", label: "B", saved: true },
      ],
      months: { "2026-01": { a: paid(30), b: paid(70) } },
    };
    expect(potsTotal(potViews(data, "2026-01"))).toBe(100);
  });

  it("is zero when every pot has been settled", () => {
    const data = build({ "2026-01": paid(50) }, [{ month: "2026-01", bill: 50 }]);
    expect(potsTotal(potViews(data, "2026-01"))).toBe(0);
  });
});

describe("isRetired", () => {
  const retiring = (after: RentLineItem) =>
    build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": after },
      [{ month: "2026-02", bill: 100 }],
    );

  it("is false for the month the pot settled in", () => {
    expect(isRetired(retiring(unpaid(0)), POT, "2026-02", "2026-03")).toBe(false);
  });

  it("is false for months the pot was still funding", () => {
    expect(isRetired(retiring(unpaid(0)), POT, "2026-01", "2026-03")).toBe(false);
  });

  it("is true once settled with nothing allocated or paid since", () => {
    expect(isRetired(retiring(unpaid(0)), POT, "2026-03", "2026-03")).toBe(true);
  });

  it("is false when a later month still carries an allocation", () => {
    expect(isRetired(retiring(unpaid(50)), POT, "2026-03", "2026-03")).toBe(false);
  });

  it("is false when a later month has been paid", () => {
    expect(isRetired(retiring(paid(50)), POT, "2026-03", "2026-03")).toBe(false);
  });

  it("is false for a pot that has never been settled", () => {
    const data = build({ "2026-01": paid(50), "2026-02": unpaid(0) });
    expect(isRetired(data, POT, "2026-02", "2026-02")).toBe(false);
  });
});
