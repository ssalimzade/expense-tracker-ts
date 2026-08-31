import { describe, expect, it } from "vitest";
import { serializeTransactions } from "./transactions";
import { sha256Hex } from "./hash";
import { fakeSql, type TxFixture } from "./testSql";

const tx = (over: Partial<TxFixture> & { created: string; description: string }): TxFixture => ({
  table: "monzo_transactions",
  amount: -10,
  ...over,
});

const at = (day: string) => `${day}T10:00:00`;

const run = (
  transactions: TxFixture[],
  month?: string,
  config: Record<string, unknown> = {},
) => serializeTransactions(fakeSql({ transactions, config }), month);

/** The plain flag id: sha256("description|created"). */
const plainId = (t: TxFixture) => sha256Hex(`${t.description}|${t.created}`);

/** `one_time_flags`, keyed by month then flag id. */
const flagsFor = async (
  month: string,
  entries: [TxFixture, Record<string, unknown>][],
) => {
  const monthFlags: Record<string, unknown> = {};
  for (const [t, flag] of entries) monthFlags[await plainId(t)] = flag;
  return { [month]: monthFlags };
};

describe("which rows come back", () => {
  it("drops TFL travel charges", async () => {
    const out = await run([
      tx({ created: at("2026-03-02"), description: "TFL TRAVEL CHARGE" }),
      tx({ created: at("2026-03-03"), description: "TESCO" }),
    ]);
    expect(out.map((r) => r.description)).toEqual(["TESCO"]);
  });

  it("drops them even with whitespace around the name", async () => {
    const out = await run([
      tx({ created: at("2026-03-02"), description: "  TFL TRAVEL CHARGE  " }),
    ]);
    expect(out).toEqual([]);
  });

  it("reads every table for a month except flex", async () => {
    const out = await run(
      [
        tx({ table: "monzo_transactions", created: at("2026-03-02"), description: "A" }),
        tx({ table: "chase_transactions", created: at("2026-03-03"), description: "B" }),
        tx({ table: "amex_transactions", created: at("2026-03-04"), description: "C" }),
        tx({ table: "hsbc_transactions", created: at("2026-03-05"), description: "D" }),
        tx({ table: "flex_transactions", created: at("2026-03-06"), description: "E" }),
      ],
      "2026-03",
    );
    expect(out.map((r) => r.description).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("includes flex when no month is asked for", async () => {
    const out = await run([
      tx({ table: "monzo_transactions", created: at("2026-03-02"), description: "A" }),
      tx({ table: "flex_transactions", created: at("2026-03-06"), description: "E" }),
    ]);
    expect(out.map((r) => r.description).sort()).toEqual(["A", "E"]);
  });

  it("bounds a month at its own first and last day", async () => {
    const out = await run(
      [
        tx({ created: at("2026-02-28"), description: "BEFORE" }),
        tx({ created: at("2026-03-01"), description: "FIRST" }),
        tx({ created: at("2026-03-31"), description: "LAST" }),
        tx({ created: at("2026-04-01"), description: "AFTER" }),
      ],
      "2026-03",
    );
    expect(out.map((r) => r.description).sort()).toEqual(["FIRST", "LAST"]);
  });

  it("rolls December's window into the next January", async () => {
    const out = await run(
      [
        tx({ created: at("2026-12-31"), description: "DECEMBER" }),
        tx({ created: at("2027-01-01"), description: "JANUARY" }),
      ],
      "2026-12",
    );
    expect(out.map((r) => r.description)).toEqual(["DECEMBER"]);
  });

  it("sorts newest first", async () => {
    const out = await run([
      tx({ created: at("2026-03-02"), description: "MIDDLE" }),
      tx({ created: at("2026-03-05"), description: "NEWEST" }),
      tx({ created: at("2026-03-01"), description: "OLDEST" }),
    ]);
    expect(out.map((r) => r.description)).toEqual(["NEWEST", "MIDDLE", "OLDEST"]);
  });
});

describe("flag ids", () => {
  it("hashes description and created for a row that stands alone", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const [out] = await run([row]);
    expect(out.flag_id).toBe(await plainId(row));
  });

  // HSBC stamps every purchase on a day 00:00:00, so two visits to one shop are
  // identical in both hashed fields. Without separation they share a flag, and a
  // category set on one lands on both.
  it("gives rows sharing a description and timestamp separate ids", async () => {
    const out = await run([
      tx({ id: "b", created: "2026-03-02T00:00:00", description: "CO-OP", amount: -4 }),
      tx({ id: "a", created: "2026-03-02T00:00:00", description: "CO-OP", amount: -7 }),
    ]);
    const ids = out.map((r) => r.flag_id);
    expect(new Set(ids).size).toBe(2);
  });

  it("leaves the first of a group on the plain hash, so stored flags stay attached", async () => {
    const first = tx({ id: "a", created: "2026-03-02T00:00:00", description: "CO-OP" });
    const out = await run([
      tx({ id: "b", created: "2026-03-02T00:00:00", description: "CO-OP" }),
      first,
    ]);
    const byId = new Map(out.map((r) => [r.id, r.flag_id]));
    expect(byId.get("a")).toBe(await plainId(first));
    expect(byId.get("b")).toBe(await sha256Hex(`CO-OP|2026-03-02T00:00:00|b`));
  });

  it("decides the group order by the bank's row id, not the order rows arrive", async () => {
    const rows = [
      tx({ id: "b", created: "2026-03-02T00:00:00", description: "CO-OP" }),
      tx({ id: "a", created: "2026-03-02T00:00:00", description: "CO-OP" }),
    ];
    const forwards = await run(rows);
    const backwards = await run([...rows].reverse());
    const idsOf = (out: Record<string, any>[]) =>
      new Map(out.map((r) => [r.id, r.flag_id]));
    expect(idsOf(forwards)).toEqual(idsOf(backwards));
  });

  it("keeps rows apart when only the timestamp differs", async () => {
    const out = await run([
      tx({ created: "2026-03-02T09:00:00", description: "CO-OP" }),
      tx({ created: "2026-03-02T17:00:00", description: "CO-OP" }),
    ]);
    expect(new Set(out.map((r) => r.flag_id)).size).toBe(2);
  });
});

describe("categorising", () => {
  it("fills in the sub-category and its parent", async () => {
    const [out] = await run([tx({ created: at("2026-03-02"), description: "TESCO" })]);
    expect(out).toMatchObject({ subcategory: "Groceries", category: "Groceries" });
  });

  it("maps a sub-category onto a different parent", async () => {
    const [out] = await run([tx({ created: at("2026-03-02"), description: "FIVE GUYS" })]);
    expect(out).toMatchObject({ subcategory: "Going Out", category: "Social Life" });
  });

  it("leaves an unrecognised row Uncategorized", async () => {
    const [out] = await run([tx({ created: at("2026-03-02"), description: "MYSTERY" })]);
    expect(out).toMatchObject({ subcategory: "Uncategorized", category: "Uncategorized" });
  });

  it("falls back to the merchant name", async () => {
    const [out] = await run([
      tx({ created: at("2026-03-02"), description: "CARD 1234", merchant_name: "TESCO" }),
    ]);
    expect(out.subcategory).toBe("Groceries");
  });

  it("passes the timestamp through, so a rule applies only from its `since`", async () => {
    const rules = { "DD 8891": { subcategory: "Shopping", since: "2026-03-10T00:00:00" } };
    const out = await run(
      [
        tx({ created: at("2026-03-05"), description: "DD 8891" }),
        tx({ created: at("2026-03-15"), description: "DD 8891" }),
      ],
      undefined,
      { category_rules: rules },
    );
    const byDate = new Map(out.map((r) => [r.created, r.subcategory]));
    // Before the stamp the keywords have no answer either, so the rule gap-fills.
    expect(byDate.get(at("2026-03-05"))).toBe("Shopping");
    expect(byDate.get(at("2026-03-15"))).toBe("Shopping");
  });
});

describe("per-row overrides", () => {
  it("replaces the sub-category and re-derives the parent from it", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-03", [[row, { subcategory: "Dating" }]]) };
    const [out] = await run([row], "2026-03", config);
    expect(out).toMatchObject({ subcategory: "Dating", category: "Social Life" });
  });

  it("falls back to Uncategorized for a sub-category with no parent", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = {
      one_time_flags: await flagsFor("2026-03", [[row, { subcategory: "Nonsense" }]]),
    };
    const [out] = await run([row], "2026-03", config);
    expect(out).toMatchObject({ subcategory: "Nonsense", category: "Uncategorized" });
  });

  it("marks the row as overridden so the UI can offer to drop it", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-03", [[row, { subcategory: "Dating" }]]) };
    const [out] = await run([row], "2026-03", config);
    expect(out.overridden).toBe(true);
  });

  it("is not overridden when the flag carries only notes", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-03", [[row, { notes: "hi" }]]) };
    const [out] = await run([row], "2026-03", config);
    expect(out).toMatchObject({ overridden: false, subcategory: "Groceries", notes: "hi" });
  });

  it("ignores flags filed under another month", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-02", [[row, { subcategory: "Dating" }]]) };
    const [out] = await run([row], "2026-03", config);
    expect(out.subcategory).toBe("Groceries");
  });

  it("reads no flags at all when no month is asked for", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-03", [[row, { subcategory: "Dating" }]]) };
    const [out] = await run([row], undefined, config);
    expect(out.subcategory).toBe("Groceries");
  });
});

describe("the row it hands back", () => {
  it("defaults notes to empty and one_time to false", async () => {
    const [out] = await run([tx({ created: at("2026-03-02"), description: "TESCO" })]);
    expect(out).toMatchObject({ notes: "", one_time: false, overridden: false });
  });

  it("carries notes and one_time from the flag", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = {
      one_time_flags: await flagsFor("2026-03", [[row, { notes: "split", one_time: true }]]),
    };
    const [out] = await run([row], "2026-03", config);
    expect(out).toMatchObject({ notes: "split", one_time: true });
  });

  it("coerces a truthy one_time flag to a real boolean", async () => {
    const row = tx({ created: at("2026-03-02"), description: "TESCO" });
    const config = { one_time_flags: await flagsFor("2026-03", [[row, { one_time: 1 }]]) };
    const [out] = await run([row], "2026-03", config);
    expect(out.one_time).toBe(true);
  });

  it("passes the bank's own columns straight through", async () => {
    const [out] = await run([
      tx({
        id: "mz-1",
        created: at("2026-03-02"),
        description: "TESCO",
        amount: -12.34,
        currency: "GBP",
        merchant_name: "Tesco",
        status: "booked",
        source: "monzo",
      }),
    ]);
    expect(out).toMatchObject({
      id: "mz-1",
      created: at("2026-03-02"),
      description: "TESCO",
      amount: -12.34,
      currency: "GBP",
      merchant_name: "Tesco",
      status: "booked",
      source: "monzo",
    });
  });
});
