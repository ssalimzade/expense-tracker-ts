import { describe, expect, it } from "vitest";
import type { RentData } from "../types/rent";
import { rentBill, rentCell, rentContribution, rentIsPaid, rentMatch, rentShare } from "./rent";

// Only `months` and `reconciled` reach this module, so the rest stays empty.
const data = (
  months: RentData["months"],
  reconciled?: RentData["reconciled"],
): RentData => ({ items: [], months, reconciled });

const MATCH = { amount: 1900, date: "2026-08-01", description: "RENT" };

describe("rentCell", () => {
  it("falls back to a blank item for an unknown month", () => {
    expect(rentCell(data({}), "2026-08", "flat")).toEqual({ amount: 0, paid: false });
  });

  it("falls back to a blank item for an unknown key in a known month", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true } } });
    expect(rentCell(d, "2026-08", "wifi")).toEqual({ amount: 0, paid: false });
  });
});

describe("rentBill precedence", () => {
  it("uses the allocation when nothing is paid or matched", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: false } } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
  });

  it("uses paid_amount when ticked by hand", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true, paid_amount: 1850 } } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1850);
  });

  it("falls back to the allocation when ticked with no paid_amount", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true } } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
  });

  it("treats a null paid_amount as 'paid exactly what was allocated'", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true, paid_amount: null } } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
  });

  it("lets a matched transaction win over a hand-entered paid_amount", () => {
    const d = data(
      { "2026-08": { flat: { amount: 1900, paid: true, paid_amount: 1850 } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
  });

  it("matches even when the allocation was never filled in", () => {
    const d = data({}, { "2026-08": { flat: MATCH } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
  });
});

describe("unlinked months", () => {
  it("hides the match from rentMatch", () => {
    const d = data(
      { "2026-08": { flat: { amount: 1900, paid: false, unlinked: true } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentMatch(d, "2026-08", "flat")).toBeUndefined();
  });

  it("sends rentBill back to the hand-entered figure", () => {
    const d = data(
      { "2026-08": { flat: { amount: 1700, paid: true, paid_amount: 1650, unlinked: true } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentBill(d, "2026-08", "flat")).toBe(1650);
  });

  it("only applies to the month it is set on", () => {
    const d = data(
      {
        "2026-07": { flat: { amount: 1900, paid: false } },
        "2026-08": { flat: { amount: 1900, paid: false, unlinked: true } },
      },
      { "2026-07": { flat: MATCH }, "2026-08": { flat: MATCH } },
    );
    expect(rentMatch(d, "2026-07", "flat")).toEqual(MATCH);
    expect(rentMatch(d, "2026-08", "flat")).toBeUndefined();
  });

  it("stops an unlinked match from marking the month paid", () => {
    const d = data(
      { "2026-08": { flat: { amount: 1900, paid: false, unlinked: true } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentIsPaid(d, "2026-08", "flat")).toBe(false);
  });
});

describe("rentContribution clamping", () => {
  const withContribution = (contribution: number | null | undefined) =>
    data({ "2026-08": { flat: { amount: 1900, paid: true, contribution } } });

  it("is zero when unset", () => {
    expect(rentContribution(withContribution(undefined), "2026-08", "flat")).toBe(0);
  });

  it("is zero when null", () => {
    expect(rentContribution(withContribution(null), "2026-08", "flat")).toBe(0);
  });

  it("ignores negative contributions", () => {
    expect(rentContribution(withContribution(-500), "2026-08", "flat")).toBe(0);
  });

  it("ignores NaN", () => {
    expect(rentContribution(withContribution(NaN), "2026-08", "flat")).toBe(0);
  });

  it("ignores Infinity", () => {
    expect(rentContribution(withContribution(Infinity), "2026-08", "flat")).toBe(0);
  });

  it("never exceeds the bill", () => {
    expect(rentContribution(withContribution(99999), "2026-08", "flat")).toBe(1900);
  });
});

describe("rentShare", () => {
  it("nets the flatmate's slice off the bill", () => {
    // The real arrangement: £1,900 leaves the account, £200 comes back.
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true, contribution: 200 } } });
    expect(rentBill(d, "2026-08", "flat")).toBe(1900);
    expect(rentShare(d, "2026-08", "flat")).toBe(1700);
  });

  it("equals the bill when nothing is contributed", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true } } });
    expect(rentShare(d, "2026-08", "flat")).toBe(1900);
  });

  it("nets against the matched amount, not the allocation", () => {
    const d = data(
      { "2026-08": { flat: { amount: 0, paid: false, contribution: 200 } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentShare(d, "2026-08", "flat")).toBe(1700);
  });

  it("never goes negative, however large the contribution", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true, contribution: 99999 } } });
    expect(rentShare(d, "2026-08", "flat")).toBe(0);
  });
});

describe("rentIsPaid", () => {
  it("is true when ticked by hand", () => {
    const d = data({ "2026-08": { flat: { amount: 1900, paid: true } } });
    expect(rentIsPaid(d, "2026-08", "flat")).toBe(true);
  });

  it("is true on a match alone, without the tick", () => {
    const d = data(
      { "2026-08": { flat: { amount: 1900, paid: false } } },
      { "2026-08": { flat: MATCH } },
    );
    expect(rentIsPaid(d, "2026-08", "flat")).toBe(true);
  });

  it("is false with neither", () => {
    expect(rentIsPaid(data({}), "2026-08", "flat")).toBe(false);
  });
});
