import { describe, expect, it } from "vitest";
import { fakeSql, type TxFixture } from "./testSql";
import {
  RENT_DEFAULT_ITEMS,
  loadAccountBalances,
  loadRentData,
  upsertRentItem,
  cleanSavingsGoal,
  upsertSavingsGoal,
  deleteSavingsGoal,
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

  it("records the month a new item starts in", async () => {
    const sql = sqlWith({ items: [], months: {} });
    const data = await upsertRentItem(sql, { label: "Hot Water", saved: true, pot_default: true, since: "2026-11" });
    expect(itemsOf(data)[0]).toMatchObject({ key: "hot_water", since: "2026-11" });
  });

  it("never gives an existing item a start month — it has history", async () => {
    const sql = sqlWith({ items: [{ key: "water", label: "Water", saved: false }], months: {} });
    const data = await upsertRentItem(sql, { key: "water", label: "Water", saved: true, pot_default: false, since: "2026-11" });
    expect(find(data, "water")).not.toHaveProperty("since");
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

describe("savings goals", () => {
  const goal = { name: "House deposit", target: 50_000, deadline: "2027-12", saved: null, monthly: null };
  const at = (month: string) => `2026-${month}-01T00:00:00.000Z`;

  it("cleans a goal: trims, rounds, and reads a £0 plan as no plan", () => {
    const g = cleanSavingsGoal({ ...goal, id: "g1", name: "  House deposit  ", target: "50000.4", saved: 1999.6, monthly: 0 });
    expect(g).toMatchObject({ id: "g1", name: "House deposit", target: 50_000, saved: 2_000, monthly: null, deadline: "2027-12" });
  });

  it("rejects what it can't save", () => {
    expect(cleanSavingsGoal({ ...goal, id: "g1", name: " " })).toBe("name is required");
    expect(cleanSavingsGoal({ ...goal, id: "g1", target: 0 })).toMatch(/target/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", target: 1e12 })).toMatch(/target/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", deadline: "2027-13" })).toMatch(/deadline/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", saved: "lots" })).toMatch(/saved/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", monthly: -5 })).toMatch(/monthly/);
    expect(cleanSavingsGoal({ ...goal, id: "../x" })).toMatch(/id/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", start: "2027-1" })).toMatch(/start/);
    expect(cleanSavingsGoal({ ...goal, id: "g1", start: "2028-01", deadline: "2027-12" })).toMatch(/before the start/);
  });

  it("keeps a start month, and none means saving starts next month", () => {
    expect(cleanSavingsGoal({ ...goal, id: "g1", start: "2027-01" })).toMatchObject({ start: "2027-01" });
    expect(cleanSavingsGoal({ ...goal, id: "g1" })).toMatchObject({ start: null });
  });

  it("treats a blank saved amount as tracking the balance", () => {
    expect(cleanSavingsGoal({ ...goal, id: "g1", saved: "" })).toMatchObject({ saved: null });
  });

  it("gives a new goal its id", async () => {
    const sql = fakeSql({ config: {} });
    const goals = (await upsertSavingsGoal(sql, goal)) as any[];
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("edits a goal in place, keeping when it was made", async () => {
    const sql = fakeSql({ config: {} });
    await upsertSavingsGoal(sql, { id: "g1", ...goal, created_at: at("01") });
    await upsertSavingsGoal(sql, { id: "g2", ...goal, name: "Car", created_at: at("02") });
    const goals = (await upsertSavingsGoal(sql, { id: "g1", ...goal, target: 60_000, created_at: at("09") })) as any[];
    expect(goals.map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(goals[0]).toMatchObject({ target: 60_000, created_at: at("01") });
  });

  it("keeps the fields a save leaves out", async () => {
    const sql = fakeSql({ config: {} });
    await upsertSavingsGoal(sql, { id: "g1", ...goal });
    // A plan saved from the planner, then an edit that doesn't know about it.
    await upsertSavingsGoal(sql, { id: "g1", monthly: 1_500 });
    const { monthly: _, ...edit } = { ...goal, name: "Flat deposit" };
    const goals = (await upsertSavingsGoal(sql, { id: "g1", ...edit })) as any[];
    expect(goals[0]).toMatchObject({ name: "Flat deposit", monthly: 1_500, target: 50_000 });
  });

  it("won't bring back a deleted goal from a plan save", async () => {
    const sql = fakeSql({ config: {} });
    expect(await upsertSavingsGoal(sql, { id: "gone", monthly: 500 })).toBe("name is required");
  });

  it("puts a goal restored by Undo back in its old place", async () => {
    const sql = fakeSql({ config: {} });
    await upsertSavingsGoal(sql, { id: "g1", ...goal, created_at: at("01") });
    const [, g2] = (await upsertSavingsGoal(sql, { id: "g2", ...goal, created_at: at("02") })) as any[];
    await upsertSavingsGoal(sql, { id: "g3", ...goal, created_at: at("03") });
    await deleteSavingsGoal(sql, "g2");
    const goals = (await upsertSavingsGoal(sql, g2)) as any[];
    expect(goals.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
  });

  it("deletes only the goal asked for", async () => {
    const sql = fakeSql({ config: {} });
    await upsertSavingsGoal(sql, { id: "g1", ...goal });
    await upsertSavingsGoal(sql, { id: "g2", ...goal });
    expect((await deleteSavingsGoal(sql, "g1")).map((g) => g.id)).toEqual(["g2"]);
  });
});
