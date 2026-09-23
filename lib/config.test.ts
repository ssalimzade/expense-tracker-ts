import { describe, expect, it } from "vitest";
import { fakeSql, type TxFixture } from "./testSql";
import {
  RENT_DEFAULT_ITEMS,
  loadAccountBalances,
  loadRentData,
  upsertRentItem,
} from "./config";

type Item = { key: string; label: string; saved: boolean; pot_default?: boolean };

const sqlWith = (rentData?: unknown) =>
  fakeSql({ config: rentData === undefined ? {} : { rent_data: rentData } });

const itemsOf = (data: any): Item[] => data.items;
const find = (data: any, key: string) => itemsOf(data).find((i) => i.key === key);

describe("upsertRentItem — giving an existing bill a pot", () => {
  it("turns on `saved` and pins the default to payments", async () => {
    const sql = sqlWith({ items: [...RENT_DEFAULT_ITEMS], months: {} });
    const data = await upsertRentItem(sql, {
      key: "water",
      label: "Water",
      saved: true,
      pot_default: false,
    });
    expect(find(data, "water")).toEqual({
      key: "water",
      label: "Water",
      saved: true,
      pot_default: false,
    });
  });

  it("leaves recorded months untouched", async () => {
    const months = { "2026-01": { water: { amount: 40, paid: true } } };
    const sql = sqlWith({ items: [...RENT_DEFAULT_ITEMS], months });
    const data = await upsertRentItem(sql, { key: "water", label: "Water", saved: true, pot_default: false });
    expect(data.months).toEqual(months);
  });

  it("adds no item — the bill it attaches to already exists", async () => {
    const sql = sqlWith({ items: [...RENT_DEFAULT_ITEMS], months: {} });
    const data = await upsertRentItem(sql, { key: "water", label: "Water", saved: true, pot_default: false });
    expect(itemsOf(data)).toHaveLength(RENT_DEFAULT_ITEMS.length);
  });

  it("persists, so the next read sees the pot", async () => {
    const sql = sqlWith({ items: [...RENT_DEFAULT_ITEMS], months: {} });
    await upsertRentItem(sql, { key: "water", label: "Water", saved: true, pot_default: false });
    expect(find(await loadRentData(sql), "water")?.saved).toBe(true);
  });

  it("drops pot_default rather than storing it undefined when removing a pot", async () => {
    const sql = sqlWith({
      items: [{ key: "water", label: "Water", saved: true, pot_default: false }],
      months: {},
    });
    const data = await upsertRentItem(sql, { key: "water", label: "Water", saved: false });
    expect(find(data, "water")).toEqual({ key: "water", label: "Water", saved: false });
  });

  it("removes the item, its months, and settlement history when a pot is truly deleted", async () => {
    const sql = sqlWith({
      items: [{ key: "hot_water", label: "Hot Water", saved: true }],
      months: {
        "2026-01": { hot_water: { amount: 50, paid: true, to_pot: true } },
        "2026-02": { hot_water: { amount: 40, paid: true, to_pot: true } },
      },
      pots: { hot_water: { settlements: [{ month: "2026-01", bill: 90 }] } },
    });

    const data = await upsertRentItem(sql, {
      key: "hot_water",
      label: "Hot Water",
      saved: false,
      delete: true,
    });

    expect(find(data, "hot_water")).toBeUndefined();
    expect(data.months["2026-01"]).toBeUndefined();
    expect(data.months["2026-02"]).toBeUndefined();
    expect(data.pots?.hot_water).toBeUndefined();
  });
});

describe("upsertRentItem — a brand new pot", () => {
  it("derives a key from the label", async () => {
    const sql = sqlWith({ items: [], months: {} });
    const data = await upsertRentItem(sql, {
      label: "Service Charge",
      saved: true,
      pot_default: true,
    });
    expect(itemsOf(data)).toEqual([
      { key: "service_charge", label: "Service Charge", saved: true, pot_default: true },
    ]);
  });

  it("strips punctuation and collapses runs of it", async () => {
    const sql = sqlWith({ items: [], months: {} });
    const data = await upsertRentItem(sql, { label: "  Water — (Savings)!  ", saved: true });
    expect(itemsOf(data)[0].key).toBe("water_savings");
  });

  it("suffixes a key that is already taken", async () => {
    const sql = sqlWith({ items: [{ key: "water", label: "Water", saved: false }], months: {} });
    const data = await upsertRentItem(sql, { label: "Water", saved: true, pot_default: true });
    expect(itemsOf(data).map((i) => i.key)).toEqual(["water", "water_2"]);
  });

  it("falls back to a usable key when the label has nothing to slug", async () => {
    const sql = sqlWith({ items: [], months: {} });
    const data = await upsertRentItem(sql, { label: "£££", saved: true });
    expect(itemsOf(data)[0].key).toBe("item");
  });

  it("seeds the defaults when no rent data exists yet", async () => {
    const sql = sqlWith();
    const data = await upsertRentItem(sql, { label: "Service Charge", saved: true, pot_default: true });
    expect(itemsOf(data)).toHaveLength(RENT_DEFAULT_ITEMS.length + 1);
    expect(find(data, "flat")).toBeDefined();
  });
});

describe("loadAccountBalances — pending AMEX charges", () => {
  const PULL = "2026-09-21T16:00:14";
  const amex = (t: Partial<TxFixture>): TxFixture => ({
    table: "amex_transactions",
    created: "2026-09-20T23:00:00",
    description: "PRET A MANGER",
    amount: -5.6,
    status: "pending",
    last_seen_at: PULL,
    ...t,
  });

  const load = (transactions: TxFixture[]) =>
    loadAccountBalances(fakeSql({ balances: { amex: -635.64, monzo: 98.46 }, transactions }));

  it("folds live pending charges into the AMEX balance", async () => {
    const out = await load([
      amex({}),
      amex({ description: "VAPE STATION", amount: -7 }),
      amex({ description: "WAITROSE", amount: -73.6, status: "booked" }),
    ]);
    expect(out.amex).toBe(-648.24);
    expect(out.amex_pending).toBe(-12.6);
  });

  it("leaves the debit balances alone", async () => {
    const out = await load([amex({})]);
    expect(out.monzo).toBe(98.46);
  });

  it("ignores pending rows the feed has stopped sending", async () => {
    // The stale row's charge already booked under a fresh id, so counting it
    // would take it off the balance twice.
    const out = await load([
      amex({ description: "CO-OP", amount: -7 }),
      amex({ description: "BOLT", amount: -6, last_seen_at: null }),
      amex({ description: "UBER", amount: -9, last_seen_at: "2026-07-04T04:00:23" }),
    ]);
    expect(out.amex).toBe(-642.64);
  });

  it("ignores the bare TFL rows the transaction list drops", async () => {
    const out = await load([amex({ description: "TFL TRAVEL CHARGE", amount: -10.5 })]);
    expect(out.amex).toBe(-635.64);
    expect(out.amex_pending).toBe(0);
  });

  it("reports the issuer balance untouched when nothing is pending", async () => {
    const out = await load([amex({ amount: -73.6, status: "booked" })]);
    expect(out.amex).toBe(-635.64);
  });
});
