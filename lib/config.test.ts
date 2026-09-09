import { describe, expect, it } from "vitest";
import { fakeSql } from "./testSql";
import { RENT_DEFAULT_ITEMS, loadRentData, upsertRentItem } from "./config";

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
