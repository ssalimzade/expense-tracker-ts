import { describe, expect, it } from "vitest";
import { categoryTotals } from "./synthetic";
import { makeTransactionId } from "./hash";
import { fakeSql, type TxFixture } from "./testSql";

const flex = (
  description: string,
  repayments: { date: string | null; amount: number | null }[],
  created = "2026-01-15T10:00:00",
): TxFixture => ({
  table: "flex_transactions",
  created,
  description,
  amount: -300,
  repayments,
});

const split = (date: string | null, amount: number | null) => ({ date, amount });

/** The repayment id: sha256("description|created"). */
const ridOf = (t: TxFixture) => makeTransactionId(t.description, t.created);

const flagsFor = async (entries: [TxFixture, string][]) => {
  const out: Record<string, unknown> = {};
  for (const [t, category] of entries) out[await ridOf(t)] = { category };
  return out;
};

const run = (
  transactions: TxFixture[],
  config: Record<string, unknown>,
  month = "2026-03",
) => categoryTotals(fakeSql({ transactions, config }), month);

describe("summing a month's repayments", () => {
  it("adds up the splits that land in the month", async () => {
    const t = flex("SOFA", [
      split("2026-03-01", -50),
      split("2026-03-15", -50),
      split("2026-04-01", -50),
    ]);
    const out = await run([t], {
      scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]),
    });
    expect(out).toEqual({ Shopping: 100 });
  });

  it("groups several repayments under one category", async () => {
    const a = flex("SOFA", [split("2026-03-01", -50)], "2026-01-15T10:00:00");
    const b = flex("LAMP", [split("2026-03-02", -25)], "2026-01-16T10:00:00");
    const out = await run([a, b], {
      scheduled_repayment_flags: await flagsFor([
        [a, "Shopping"],
        [b, "Shopping"],
      ]),
    });
    expect(out).toEqual({ Shopping: 75 });
  });

  it("keeps categories apart", async () => {
    const a = flex("SOFA", [split("2026-03-01", -50)], "2026-01-15T10:00:00");
    const b = flex("DINNER", [split("2026-03-02", -25)], "2026-01-16T10:00:00");
    const out = await run([a, b], {
      scheduled_repayment_flags: await flagsFor([
        [a, "Shopping"],
        [b, "Social Life"],
      ]),
    });
    expect(out).toEqual({ Shopping: 50, "Social Life": 25 });
  });

  it("reports positive amounts and rounds to the penny", async () => {
    const t = flex("SOFA", [split("2026-03-01", -33.333), split("2026-03-02", -33.334)]);
    const out = await run([t], {
      scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]),
    });
    expect(out).toEqual({ Shopping: 66.67 });
  });

  it("reads a date that carries a time as well", async () => {
    const t = flex("SOFA", [split("2026-03-01T00:00:00", -50)]);
    const out = await run([t], {
      scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]),
    });
    expect(out).toEqual({ Shopping: 50 });
  });
});

describe("splits that do not count", () => {
  const only = async (repayments: { date: string | null; amount: number | null }[]) => {
    const t = flex("SOFA", repayments);
    return run([t], { scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]) });
  };

  it("ignores a split in another month", async () => {
    expect(await only([split("2026-02-28", -50)])).toEqual({});
  });

  it("ignores a split with no date scheduled", async () => {
    expect(await only([split(null, -50)])).toEqual({});
  });

  it("ignores a split with no amount", async () => {
    expect(await only([split("2026-03-01", null)])).toEqual({});
  });

  it("ignores a zero split", async () => {
    expect(await only([split("2026-03-01", 0)])).toEqual({});
  });

  it("leaves a category out entirely when nothing of its lands in the month", async () => {
    expect(await only([split("2026-04-01", -50)])).toEqual({});
  });
});

describe("repayments that do not count", () => {
  it("skips the internal Flex row", async () => {
    const t = flex("Flex", [split("2026-03-01", -50)]);
    const out = await run([t], {
      scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]),
    });
    expect(out).toEqual({});
  });

  it("skips a repayment the user deleted", async () => {
    const t = flex("SOFA", [split("2026-03-01", -50)]);
    const out = await run([t], {
      scheduled_repayment_flags: await flagsFor([[t, "Shopping"]]),
      deleted_repayments: [await ridOf(t)],
    });
    expect(out).toEqual({});
  });

  it("skips a repayment that was never categorised", async () => {
    const t = flex("SOFA", [split("2026-03-01", -50)]);
    expect(await run([t], {})).toEqual({});
  });

  it("deletes by repayment id, leaving its neighbours alone", async () => {
    const gone = flex("SOFA", [split("2026-03-01", -50)], "2026-01-15T10:00:00");
    const kept = flex("LAMP", [split("2026-03-02", -25)], "2026-01-16T10:00:00");
    const out = await run([gone, kept], {
      scheduled_repayment_flags: await flagsFor([
        [gone, "Shopping"],
        [kept, "Shopping"],
      ]),
      deleted_repayments: [await ridOf(gone)],
    });
    expect(out).toEqual({ Shopping: 25 });
  });
});

describe("which categories are eligible", () => {
  const withCategory = async (category: string, budgets?: Record<string, unknown>) => {
    const t = flex("SOFA", [split("2026-03-01", -50)]);
    return run([t], {
      scheduled_repayment_flags: await flagsFor([[t, category]]),
      ...(budgets ? { budgets } : {}),
    });
  };

  it("falls back to the default categories when the month has no budget", async () => {
    expect(await withCategory("Groceries")).toEqual({ Groceries: 50 });
    expect(await withCategory("Travel")).toEqual({ Travel: 50 });
  });

  it("rejects a category outside the defaults when the month has no budget", async () => {
    expect(await withCategory("Holiday")).toEqual({});
  });

  it("uses the month's own budget when it has one", async () => {
    const budgets = { "2026-03": { Holiday: 500 } };
    expect(await withCategory("Holiday", budgets)).toEqual({ Holiday: 50 });
  });

  it("rejects a default category the month's budget leaves out", async () => {
    const budgets = { "2026-03": { Holiday: 500 } };
    expect(await withCategory("Groceries", budgets)).toEqual({});
  });

  it("falls back to the defaults when the month's budget is empty", async () => {
    const budgets = { "2026-03": {} };
    expect(await withCategory("Groceries", budgets)).toEqual({ Groceries: 50 });
  });

  it("ignores another month's budget", async () => {
    const budgets = { "2026-04": { Holiday: 500 } };
    expect(await withCategory("Holiday", budgets)).toEqual({});
    expect(await withCategory("Groceries", budgets)).toEqual({ Groceries: 50 });
  });

  // Savings is money moved, not money spent — it must never reach the dashboard
  // as spend, even when the month's budget lists it.
  it("never counts Savings, budgeted or not", async () => {
    expect(await withCategory("Savings")).toEqual({});
    expect(await withCategory("Savings", { "2026-03": { Savings: 500 } })).toEqual({});
  });
});
