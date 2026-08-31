import { describe, expect, it } from "vitest";
import { reconcileRent } from "./transactions";
import { makeTransactionId } from "./hash";
import { fakeSql, type TxFixture } from "./testSql";

const monzo = (
  created: string,
  description: string,
  amount: number,
  merchant_name: string | null = null,
): TxFixture => ({ table: "monzo_transactions", created, description, amount, merchant_name });

const at = (day: string) => `${day}T10:00:00`;

const run = (
  transactions: TxFixture[],
  year = 2026,
  config: Record<string, unknown> = {},
) => reconcileRent(fakeSql({ transactions, config }), year);

/** `one_time_flags` for a single month, keyed by the hash the reconciler computes. */
async function flagsFor(
  month: string,
  entries: [TxFixture, Record<string, unknown>][],
): Promise<Record<string, unknown>> {
  const monthFlags: Record<string, unknown> = {};
  for (const [tx, flag] of entries) {
    monthFlags[await makeTransactionId(tx.description, tx.created)] = flag;
  }
  return { [month]: monthFlags };
}

describe("month offsets", () => {
  it("counts rent towards the month after it was paid", async () => {
    const out = await run([monzo(at("2026-03-01"), "rent", -1900)]);
    expect(Object.keys(out)).toEqual(["2026-04"]);
    expect(out["2026-04"].flat).toMatchObject({ amount: 1900, date: "2026-03-01" });
  });

  it("counts energy towards the month before it was paid", async () => {
    const out = await run([monzo(at("2026-03-05"), "OCTOPUS ENERGY", -85.5)]);
    expect(out["2026-02"].energy).toMatchObject({ amount: 85.5 });
  });

  it("counts water, wifi and council tax in their own month", async () => {
    const out = await run([
      monzo(at("2026-03-02"), "THAMES WATER LTD", -40),
      monzo(at("2026-03-03"), "Hyperoptic Ltd", -30),
      monzo(at("2026-03-04"), "COUNCIL TAX MAR", -220),
    ]);
    expect(out["2026-03"].water).toMatchObject({ amount: 40 });
    expect(out["2026-03"].wifi).toMatchObject({ amount: 30 });
    expect(out["2026-03"].council_tax).toMatchObject({ amount: 220 });
  });

  it("rolls a December rent payment into January of the next year", async () => {
    const out = await run([monzo(at("2025-12-01"), "rent", -1900)]);
    expect(out["2026-01"].flat).toMatchObject({ amount: 1900 });
  });

  it("pulls an energy bill paid in January back into the previous December", async () => {
    const out = await run([monzo(at("2027-01-08"), "OCTOPUS ENERGY", -90)]);
    expect(out["2026-12"].energy).toMatchObject({ amount: 90 });
  });
});

describe("what never links", () => {
  it("ignores credits — a refund is not a payment", async () => {
    const out = await run([monzo(at("2026-03-02"), "THAMES WATER LTD", 40)]);
    expect(out).toEqual({});
  });

  it("still links the debit when a refund sits beside it", async () => {
    const out = await run([
      monzo(at("2026-03-02"), "THAMES WATER LTD", -40),
      monzo(at("2026-03-20"), "THAMES WATER LTD", 15),
    ]);
    expect(out["2026-03"].water).toMatchObject({ amount: 40 });
  });

  it("ignores a zero amount", async () => {
    expect(await run([monzo(at("2026-03-02"), "THAMES WATER LTD", 0)])).toEqual({});
  });

  it("ignores an unusable amount", async () => {
    expect(await run([monzo(at("2026-03-02"), "THAMES WATER LTD", NaN)])).toEqual({});
  });

  it("ignores a payment the categoriser cannot place", async () => {
    expect(await run([monzo(at("2026-03-02"), "SOME RANDOM SHOP", -40)])).toEqual({});
  });

  it("drops a target month outside the requested year", async () => {
    // December rent lands in January 2027, which is not 2026's business.
    expect(await run([monzo(at("2026-12-01"), "rent", -1900)])).toEqual({});
  });

  it("never reads rows outside the window the year can reach", async () => {
    // November 2025 is before `from`, so the query does not return it at all.
    expect(await run([monzo(at("2025-11-15"), "rent", -1900)])).toEqual({});
  });
});

describe("picking between competing payments", () => {
  it("keeps the largest payment for an item in a month", async () => {
    const out = await run([
      monzo(at("2026-03-01"), "rent", -1800),
      monzo(at("2026-03-02"), "rent", -1900),
    ]);
    expect(out["2026-04"].flat).toMatchObject({ amount: 1900, date: "2026-03-02" });
  });

  it("keeps the largest whichever order the rows arrive in", async () => {
    const out = await run([
      monzo(at("2026-03-02"), "rent", -1900),
      monzo(at("2026-03-01"), "rent", -1800),
    ]);
    expect(out["2026-04"].flat).toMatchObject({ amount: 1900, date: "2026-03-02" });
  });

  it("keeps items in the same month apart", async () => {
    const out = await run([
      monzo(at("2026-03-02"), "THAMES WATER LTD", -40),
      monzo(at("2026-03-03"), "Hyperoptic Ltd", -30),
    ]);
    expect(Object.keys(out["2026-03"]).sort()).toEqual(["water", "wifi"]);
  });

  it("reconciles across all the bank tables, not just one", async () => {
    const out = await run([
      { table: "hsbc_transactions", created: at("2026-03-01"), description: "rent", amount: -1900 },
      {
        table: "amex_transactions",
        created: at("2026-03-02"),
        description: "THAMES WATER LTD",
        amount: -40,
      },
    ]);
    expect(out["2026-04"].flat).toMatchObject({ amount: 1900 });
    expect(out["2026-03"].water).toMatchObject({ amount: 40 });
  });
});

describe("the record it hands back", () => {
  it("rounds the amount to the penny and drops the sign", async () => {
    const out = await run([monzo(at("2026-03-02"), "THAMES WATER LTD", -1234.567)]);
    expect(out["2026-03"].water.amount).toBe(1234.57);
  });

  it("carries the description and merchant through", async () => {
    const out = await run([
      monzo(at("2026-03-02"), "DD 8891", -40, "Thames Water"),
    ]);
    expect(out["2026-03"].water).toMatchObject({
      description: "DD 8891",
      merchant_name: "Thames Water",
      date: "2026-03-02",
    });
  });

  it("uses the same flag_id the transactions list computes, so the UI can jump to the row", async () => {
    const tx = monzo(at("2026-03-01"), "rent", -1900);
    const out = await run([tx]);
    expect(out["2026-04"].flat.flag_id).toBe(
      await makeTransactionId(tx.description, tx.created),
    );
  });
});

describe("categorising the row", () => {
  it("falls back to the merchant when the description says nothing", async () => {
    const out = await run([monzo(at("2026-03-05"), "DD 40412", -85, "Octopus Energy")]);
    expect(out["2026-02"].energy).toMatchObject({ amount: 85 });
  });

  it("fills a gap the keywords leave, whenever the row arrived", async () => {
    // No keyword places "DD 8891", so the rule answers for it even though the
    // row predates the rule — that is what makes one fix catch its siblings.
    const rules = { "DD 8891": { subcategory: "Water", since: "2026-03-01T00:00:00" } };
    const out = await run([monzo(at("2026-02-15"), "DD 8891", -40)], 2026, {
      category_rules: rules,
    });
    expect(out["2026-02"].water).toMatchObject({ amount: 40 });
  });

  // A rule that disagrees with the keyword lists only wins from `since` onward.
  // Same description, same rule, two rows either side of the stamp.
  it("overrules the keyword lists only for rows that arrived after it was saved", async () => {
    const rules = {
      "THAMES WATER LTD": { subcategory: "Energy", since: "2026-03-01T00:00:00" },
    };
    const out = await run(
      [
        monzo(at("2026-02-15"), "THAMES WATER LTD", -40), // before: stays Water
        monzo(at("2026-03-15"), "THAMES WATER LTD", -45), // after: becomes Energy
      ],
      2026,
      { category_rules: rules },
    );
    expect(out["2026-02"].water).toMatchObject({ amount: 40 });
    expect(out["2026-02"].energy).toMatchObject({ amount: 45 }); // Energy offsets −1
  });
});

describe("per-row overrides", () => {
  it("unlinks a bill when the row is re-categorised to Uncategorized", async () => {
    const tx = monzo(at("2026-03-01"), "rent", -1900);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[tx, { subcategory: "Uncategorized" }]]),
    };
    expect(await run([tx], 2026, config)).toEqual({});
  });

  it("pulls in a payment the categoriser had no answer for", async () => {
    const tx = monzo(at("2026-03-02"), "MYSTERY PAYMENT", -40);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[tx, { subcategory: "Water" }]]),
    };
    const out = await run([tx], 2026, config);
    expect(out["2026-03"].water).toMatchObject({ amount: 40, description: "MYSTERY PAYMENT" });
  });

  it("moves a bill to another item, offset and all", async () => {
    // Rent offsets +1, Water offsets 0 — the override has to move the month too.
    const tx = monzo(at("2026-03-01"), "rent", -1900);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[tx, { subcategory: "Water" }]]),
    };
    const out = await run([tx], 2026, config);
    expect(out["2026-04"]).toBeUndefined();
    expect(out["2026-03"].water).toMatchObject({ amount: 1900 });
  });

  it("only applies to the row it was set on", async () => {
    const kept = monzo(at("2026-03-01"), "rent", -1900);
    const dropped = monzo(at("2026-03-02"), "THAMES WATER LTD", -40);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[dropped, { subcategory: "Uncategorized" }]]),
    };
    const out = await run([kept, dropped], 2026, config);
    expect(out["2026-04"].flat).toMatchObject({ amount: 1900 });
    expect(out["2026-03"]).toBeUndefined();
  });

  it("only applies to the month it was set on", async () => {
    const march = monzo(at("2026-03-02"), "THAMES WATER LTD", -40);
    const april = monzo(at("2026-04-02"), "THAMES WATER LTD", -45);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[march, { subcategory: "Uncategorized" }]]),
    };
    const out = await run([march, april], 2026, config);
    expect(out["2026-03"]).toBeUndefined();
    expect(out["2026-04"].water).toMatchObject({ amount: 45 });
  });

  // reconcileRent skips the flag lookup where it cannot change the answer: on a
  // row the rules already read as non-rent, in a month holding no rent-item
  // override. This pins that the shortcut is safe rather than merely fast.
  it("is unaffected by overrides that name no rent item", async () => {
    const tx = monzo(at("2026-03-02"), "MYSTERY PAYMENT", -40);
    const config = {
      one_time_flags: await flagsFor("2026-03", [[tx, { subcategory: "Groceries" }]]),
    };
    expect(await run([tx], 2026, config)).toEqual({});
  });
});
