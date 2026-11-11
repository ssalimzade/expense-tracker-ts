import { describe, expect, it } from "vitest";
import type { RentData, RentLineItem, RentPotSettlement } from "../types/rent";
import {
  frozenEntries,
  goesToPot,
  isRetired,
  payableMonths,
  potEntry,
  potInflow,
  potPending,
  potsTotal,
  potTrueUp,
  potViews,
  rentMonthCost,
  settlementsIn,
} from "./pots";

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
      { month: "2026-03", bill: 120, index: 0, accrued: 150, diff: 30, remaining: 0 },
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
      { month: "2026-02", bill: 90, index: 0, accrued: 100, diff: 10, remaining: 0 },
      { month: "2026-04", bill: 80, index: 1, accrued: 100, diff: 20, remaining: 0 },
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
      { month: "2026-02", bill: 40, index: 0, accrued: 50, diff: 10, remaining: 0 },
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

describe("potViews — paying in part", () => {
  const months = { "2026-01": paid(50), "2026-02": paid(25) };
  const part = (month: string, bill: number): RentPotSettlement => ({ month, bill, partial: true });

  it("takes only the bill out and keeps the rest in the pot", () => {
    const v = view(build(months, [part("2026-02", 53)]), "2026-02");
    expect(v.settlements).toEqual([
      { month: "2026-02", bill: 53, partial: true, index: 0, accrued: 75, diff: 0, remaining: 22 },
    ]);
    expect(v.balance).toBe(22);
  });

  it("leaves the pot open, so the table keeps the column", () => {
    const data = build(months, [part("2026-02", 75)]);
    const v = view(data, "2026-02");
    expect(v).toMatchObject({ balance: 0, closed: false, lastSettled: undefined });
    expect(isRetired(data, POT, "2026-03", "2026-03")).toBe(false);
  });

  it("keeps accruing on top of what was kept", () => {
    const data = build({ ...months, "2026-03": paid(30) }, [part("2026-02", 53)]);
    expect(view(data, "2026-03").balance).toBe(52); // 22 kept + 30
  });

  it("empties the pot and reports the shortfall when the bill is bigger", () => {
    const v = view(build(months, [part("2026-02", 90)]), "2026-02");
    expect(v.settlements[0]).toMatchObject({ accrued: 75, diff: -15, remaining: 0 });
    expect(v.balance).toBe(0);
  });

  it("does not leave floating-point dust in the balance", () => {
    const v = view(build(months, [part("2026-02", 53.4)]), "2026-02");
    expect(v.balance).toBe(21.6);
  });

  it("settles whatever is left after earlier part-payments", () => {
    const data = build(months, [part("2026-01", 20), { month: "2026-02", bill: 40 }]);
    const v = view(data, "2026-02");
    expect(v.settlements[0]).toMatchObject({ accrued: 50, remaining: 30 });
    expect(v.settlements[1]).toMatchObject({ accrued: 55, diff: 15, remaining: 0 });
    expect(v).toMatchObject({ balance: 0, closed: true, lastSettled: "2026-02" });
  });

  it("reopens a settled pot without moving lastSettled", () => {
    const data = build(
      { ...months, "2026-03": paid(40) },
      [{ month: "2026-01", bill: 50 }, part("2026-03", 10)],
    );
    expect(view(data, "2026-03")).toMatchObject({ balance: 55, closed: false, lastSettled: "2026-01" });
  });

  it("applies two payments in one month in the order they were recorded", () => {
    const data = build(months, [part("2026-02", 30), part("2026-02", 20)]);
    const v = view(data, "2026-02");
    expect(v.settlements.map((s) => s.remaining)).toEqual([45, 25]);
  });

  it("carries each entry's stored position through the sort, for Undo", () => {
    const data = build(months, [part("2026-02", 10), part("2026-01", 5), part("2026-02", 1)]);
    expect(view(data, "2026-02").settlements.map((s) => s.index)).toEqual([1, 0, 2]);
  });
});

describe("settlementsIn", () => {
  it("lists part-payments too, with what the pot put towards each bill", () => {
    const data = build({ "2026-01": paid(50) }, [
      { month: "2026-01", bill: 30, partial: true },
      { month: "2026-01", bill: 40, partial: true },
    ]);
    const rows = settlementsIn(data, "2026-01");
    // Pot covered the first in full; the second only had 20 left, so 20 short.
    expect(rows.map((r) => r.bill + r.diff)).toEqual([30, 20]);
    expect(rows.map((r) => r.diff)).toEqual([0, -20]);
  });

  it("puts the whole balance towards a full settlement, as before", () => {
    const data = build({ "2026-01": paid(50) }, [{ month: "2026-01", bill: 30 }]);
    const [row] = settlementsIn(data, "2026-01");
    expect(row.bill + row.diff).toBe(50);
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

/**
 * A bill that saves ahead some months and pays out in others. The pot is on the
 * bill itself, so what separates the two is the month's own `to_pot`.
 */
describe("goesToPot", () => {
  const BILL = "water";
  /** Water with a pot added later: months are payments unless they say otherwise. */
  const hybrid = (cell: RentLineItem): RentData => ({
    items: [{ key: BILL, label: "Water", saved: true, pot_default: false }],
    months: { "2026-01": { [BILL]: cell } },
  });

  it("follows the item default when the month does not say", () => {
    expect(goesToPot(hybrid(paid(50)), BILL, "2026-01")).toBe(false);
  });

  it("lets a month opt into the pot", () => {
    expect(goesToPot(hybrid({ amount: 50, paid: true, to_pot: true }), BILL, "2026-01")).toBe(true);
  });

  it("lets a month opt out of a pot that accrues by default", () => {
    const data = build({ "2026-01": { amount: 50, paid: true, to_pot: false } });
    expect(goesToPot(data, POT, "2026-01")).toBe(false);
  });

  it("treats null as unstated rather than as false", () => {
    const data = build({ "2026-01": { amount: 50, paid: true, to_pot: null } });
    expect(goesToPot(data, POT, "2026-01")).toBe(true);
  });

  it("defaults to `saved` for items predating pot_default", () => {
    expect(goesToPot(build({ "2026-01": paid(50) }), POT, "2026-01")).toBe(true);
    expect(goesToPot(build({ "2026-01": paid(50) }), "flat", "2026-01")).toBe(false);
  });

  it("keeps a bill's history out of a pot added to it later", () => {
    // The whole point of pot_default: enabling a pot on Water must not
    // retroactively turn every water bill ever paid into a set-aside.
    const data = hybrid(paid(50));
    expect(potInflow(data, BILL, "2026-01")).toBe(0);
    expect(potViews(data, "2026-01")[0].balance).toBe(0);
  });

  it("accrues only the months marked for the pot", () => {
    const data: RentData = {
      items: [{ key: BILL, label: "Water", saved: true, pot_default: false }],
      months: {
        "2026-01": { [BILL]: paid(40) }, // bill paid out
        "2026-02": { [BILL]: { amount: 40, paid: true, to_pot: true } }, // saved ahead
        "2026-03": { [BILL]: { amount: 40, paid: true, to_pot: true } },
      },
    };
    expect(potViews(data, "2026-03")[0].balance).toBe(80);
  });

  it("does not accrue a month marked for the pot but not yet paid", () => {
    const data = hybrid({ amount: 50, paid: false, to_pot: true });
    expect(potInflow(data, BILL, "2026-01")).toBe(0);
  });
});

describe("frozen results", () => {
  const months = { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) };

  it("keeps a settlement's result when an earlier month is edited afterwards", () => {
    // Settled at 150 with a 120 bill: 30 went back. Then January is corrected to 47.
    const settled = { month: "2026-03", bill: 120, diff: 30 };
    const data = build({ ...months, "2026-01": paid(47) }, [settled]);
    const v = view(data, "2026-03");
    expect(v.settlements[0]).toMatchObject({ accrued: 147, diff: 30 });
    // The 3 that was never there shows up in the pot, rather than rewriting March.
    expect(v.balance).toBe(-3);
    expect(v.closed).toBe(false);
  });

  it("reads exactly as before when nothing has been edited", () => {
    const data = build(months, [{ month: "2026-03", bill: 120, diff: 30 }]);
    expect(view(data, "2026-03")).toMatchObject({ balance: 0, closed: true });
  });

  it("still works out entries that predate the frozen figure", () => {
    const data = build({ ...months, "2026-01": paid(47) }, [{ month: "2026-03", bill: 120 }]);
    expect(view(data, "2026-03").settlements[0]).toMatchObject({ diff: 27, remaining: 0 });
  });

  it("keeps a part-payment's shortfall when an earlier month is edited", () => {
    const data = build({ ...months, "2026-01": paid(60) }, [
      { month: "2026-03", bill: 200, partial: true, diff: -50 },
    ]);
    const v = view(data, "2026-03");
    expect(v.settlements[0].diff).toBe(-50);
    expect(v.balance).toBe(10); // 160 in − 200 bill + 50 from savings
  });

  it("lets any entry be removed without disturbing the others", () => {
    const entries = [
      { month: "2026-01", bill: 20, partial: true, diff: 0 },
      { month: "2026-02", bill: 30, partial: true, diff: 0 },
    ];
    const without = build(months, [entries[1]]);
    expect(view(without, "2026-03").settlements[0]).toMatchObject({ diff: 0, remaining: 70 });
    expect(view(without, "2026-03").balance).toBe(120);
  });
});

describe("potEntry", () => {
  const data = build({ "2026-01": paid(50), "2026-02": paid(25) });

  it("freezes a part-payment covered by the pot as moving nothing", () => {
    expect(potEntry(data, POT, "2026-02", 53, true)).toEqual({
      month: "2026-02",
      bill: 53,
      diff: 0,
      partial: true,
    });
  });

  it("freezes a part-payment's shortfall", () => {
    expect(potEntry(data, POT, "2026-02", 90, true).diff).toBe(-15);
  });

  it("freezes what a settlement sends back", () => {
    expect(potEntry(data, POT, "2026-02", 53, false)).toEqual({ month: "2026-02", bill: 53, diff: 22 });
  });

  it("works from the balance in the month it is dated, not today's", () => {
    expect(potEntry(data, POT, "2026-01", 20, false).diff).toBe(30);
  });
});

describe("payableMonths", () => {
  it("runs from the first month money went in up to now, newest first", () => {
    const data = build({ "2026-01": unpaid(50), "2026-02": paid(50), "2026-03": paid(50) });
    expect(payableMonths(data, POT, "2026-04")).toEqual(["2026-04", "2026-03", "2026-02"]);
  });

  it("starts at the last settlement, so a closed pot can't be paid from", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50), "2026-03": paid(50) },
      [{ month: "2026-02", bill: 90 }],
    );
    expect(payableMonths(data, POT, "2026-03")).toEqual(["2026-03", "2026-02"]);
  });

  it("caps how far back it goes", () => {
    const months = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`2025-${String((i % 12) + 1).padStart(2, "0")}`, paid(10)]),
    );
    expect(payableMonths(build(months), POT, "2026-06", 3)).toEqual(["2026-06", "2026-05", "2026-04"]);
  });

  it("offers just this month for a pot nothing has gone into", () => {
    expect(payableMonths(build({}), POT, "2026-04")).toEqual(["2026-04"]);
  });

  it("crosses a year boundary", () => {
    const data = build({ "2025-11": paid(10), "2026-01": paid(10) });
    expect(payableMonths(data, POT, "2026-01")).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});

describe("what bills really cost", () => {
  // Hot Water's year: 83 set aside a month, a 304 bill in month 4, 28 back.
  const data = build(
    { "2026-01": paid(83), "2026-02": paid(83), "2026-03": paid(83), "2026-04": paid(83) },
    [{ month: "2026-04", bill: 304, diff: 28 }],
  );

  it("counts set-asides as spent in the months they go in", () => {
    expect(rentMonthCost(data, "2026-02")).toBe(83);
  });

  it("takes off what a settled pot sends back, in the month it does", () => {
    expect(potTrueUp(data, "2026-04")).toBe(-28);
    expect(rentMonthCost(data, "2026-04")).toBe(55);
  });

  it("adds up to the bill over the pot's life", () => {
    const year = ["2026-01", "2026-02", "2026-03", "2026-04"].reduce((s, m) => s + rentMonthCost(data, m), 0);
    expect(year).toBe(304);
  });

  it("adds a shortfall that savings covered", () => {
    const short = build({ "2026-01": paid(50) }, [{ month: "2026-01", bill: 80, partial: true, diff: -30 }]);
    expect(rentMonthCost(short, "2026-01")).toBe(80);
  });

  it("leaves a part-payment the pot covered alone", () => {
    const covered = build({ "2026-01": paid(50) }, [{ month: "2026-01", bill: 30, partial: true, diff: 0 }]);
    expect(rentMonthCost(covered, "2026-01")).toBe(50);
  });
});

describe("review fixes", () => {
  it("always offers this month, even when the only money in is dated later", () => {
    const data = build({ "2026-12": paid(45) });
    expect(payableMonths(data, POT, "2026-11")).toEqual(["2026-11"]);
  });

  it("never offers a month before the latest entry, part-payments included", () => {
    const data = build(
      { "2026-09": paid(100), "2026-10": paid(0), "2026-11": paid(0) },
      [{ month: "2026-11", bill: 80, partial: true, diff: 0 }],
    );
    expect(payableMonths(data, POT, "2026-11")).toEqual(["2026-11"]);
  });

  it("freezes entries recorded before results were stored, and leaves frozen ones alone", () => {
    const data = build(
      { "2026-01": paid(50), "2026-02": paid(50) },
      [
        { month: "2026-01", bill: 20, partial: true },
        { month: "2026-02", bill: 10, diff: 99 },
        { month: "2026-05", bill: 5 }, // after upTo: nothing to freeze it against
      ],
    );
    expect(frozenEntries(data, POT, "2026-02")).toEqual([
      { month: "2026-01", bill: 20, partial: true, diff: 0 },
      { month: "2026-02", bill: 10, diff: 99 },
      { month: "2026-05", bill: 5 },
    ]);
  });

  it("does not count a bill twice for a pot attached to it", () => {
    // Water: 40 set aside in Jan and Feb, the 70 bill paid out (and recorded) in Mar,
    // and the pot settled against it: 10 back to savings.
    const data: RentData = {
      items: [{ key: "water", label: "Water", saved: true, pot_default: false }],
      months: {
        "2026-01": { water: { amount: 40, paid: true, to_pot: true } },
        "2026-02": { water: { amount: 40, paid: true, to_pot: true } },
        "2026-03": { water: { amount: 70, paid: true } },
      },
      pots: { water: { settlements: [{ month: "2026-03", bill: 70, diff: 10 }] } },
    };
    const year = ["2026-01", "2026-02", "2026-03"].reduce((sum, m) => sum + rentMonthCost(data, m), 0);
    expect(year).toBe(70); // the bill, once
  });

  it("keeps a detached pot's history in the figures", () => {
    const data = build({ "2026-01": paid(50) }, [{ month: "2026-01", bill: 30, diff: 20 }]);
    data.items = data.items.map((it) => (it.key === POT ? { ...it, saved: false } : it));
    expect(settlementsIn(data, "2026-01")).toHaveLength(1);
    expect(potTrueUp(data, "2026-01")).toBe(-20);
  });

  it("flags a set-aside that is allocated but not ticked", () => {
    expect(potPending(build({ "2026-01": unpaid(45) }), POT, "2026-01")).toBe(45);
    expect(potPending(build({ "2026-01": paid(45) }), POT, "2026-01")).toBe(0);
  });
});

