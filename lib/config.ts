import type { Sql } from "./db";
import { kvGet, kvSet } from "./kv";

// Config stores in app_config. Each function mirrors a Python services/*_utils.py
// helper so read/write behavior is identical.

type Dict = Record<string, any>;

// Python-equivalent string comparison (code-point order, stable sort).
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ── budgets ─────────────────────────────────────────────────────────────────
export async function saveBudgetForMonth(sql: Sql, month: string, budgets: Dict) {
  const all = await kvGet<Dict>(sql, "budgets", {});
  all[month] = budgets;
  await kvSet(sql, "budgets", all);
}

// ── category rules ──────────────────────────────────────────────────────────
export const loadRules = (sql: Sql) =>
  kvGet<Record<string, { subcategory: string }>>(sql, "category_rules", {});
export const saveRules = (sql: Sql, rules: Dict) => kvSet(sql, "category_rules", rules);

// ── one-time flags (per month) ──────────────────────────────────────────────
export async function getFlagsForMonth(sql: Sql, month: string): Promise<Dict> {
  const all = await kvGet<Dict>(sql, "one_time_flags", {});
  return all[month] ?? {};
}
export async function setFlagsForMonth(sql: Sql, month: string, monthFlags: Dict) {
  const all = await kvGet<Dict>(sql, "one_time_flags", {});
  all[month] = monthFlags;
  await kvSet(sql, "one_time_flags", all);
}

// ── savings (re-chained series) ─────────────────────────────────────────────
function rechain(rows: Dict[]): Dict[] {
  rows.sort((a, b) => cmp(String(a.start_date ?? ""), String(b.start_date ?? "")));
  let prevEnd: number | null = null;
  for (const r of rows) {
    if (prevEnd !== null) r.starting_balance = prevEnd;
    r.ending_balance =
      (r.starting_balance ?? 0) + (r.savings ?? 0) + (r.adjustments ?? 0);
    prevEnd = r.ending_balance;
  }
  return rows;
}
export async function upsertSavingsRow(sql: Sql, row: Dict): Promise<Dict[]> {
  const rows = await kvGet<Dict[]>(sql, "savings_data", []);
  const i = rows.findIndex((r) => r.start_date === row.start_date);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  rechain(rows);
  await kvSet(sql, "savings_data", rows);
  return rows;
}

// ── projections (keyed by month, sorted) ────────────────────────────────────
export async function upsertProjectionRow(sql: Sql, row: Dict): Promise<Dict[]> {
  const rows = await kvGet<Dict[]>(sql, "projections_data", []);
  const i = rows.findIndex((r) => r.month === row.month);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  rows.sort((a, b) => cmp(String(a.month ?? ""), String(b.month ?? "")));
  await kvSet(sql, "projections_data", rows);
  return rows;
}

// ── remuneration (keyed by period) ──────────────────────────────────────────
export async function upsertRemunerationRow(sql: Sql, row: Dict): Promise<Dict[]> {
  const rows = await kvGet<Dict[]>(sql, "remuneration_data", []);
  const i = rows.findIndex((r) => r.period === row.period);
  if (i >= 0) rows[i] = row;
  else rows.push(row);
  await kvSet(sql, "remuneration_data", rows);
  return rows;
}

// ── rent ────────────────────────────────────────────────────────────────────
export const RENT_DEFAULT_ITEMS = [
  { key: "flat", label: "Rent", saved: false },
  { key: "wifi", label: "Wifi", saved: false },
  { key: "energy", label: "Energy", saved: false },
  { key: "water", label: "Water", saved: false },
  { key: "water_savings", label: "Water (Savings)", saved: true },
  { key: "council_tax", label: "Council Tax", saved: false },
  { key: "hot_water", label: "Hot Water", saved: true },
];
export const loadRentData = (sql: Sql) =>
  kvGet<Dict>(sql, "rent_data", { items: RENT_DEFAULT_ITEMS, months: {} });
export async function upsertRentMonth(sql: Sql, month: string, entry: Dict) {
  const data = await kvGet<Dict>(sql, "rent_data", {
    items: RENT_DEFAULT_ITEMS,
    months: {},
  });
  if (!data.months) data.months = {};
  data.months[month] = entry;
  await kvSet(sql, "rent_data", data);
  return data;
}

// ── notes ───────────────────────────────────────────────────────────────────
const nowIso = () => new Date().toISOString();
export async function upsertNote(sql: Sql, note: Dict): Promise<Dict[]> {
  const notes = await kvGet<Dict[]>(sql, "notes", []);
  note = { ...note, updated_at: nowIso() };
  const nid = note.id;
  if (nid) {
    const i = notes.findIndex((n) => n.id === nid);
    if (i >= 0) {
      note.created_at = notes[i].created_at ?? nowIso();
      notes[i] = { ...notes[i], ...note };
    } else {
      note.created_at = note.created_at ?? nowIso();
      notes.push(note);
    }
  } else {
    note.id = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    note.created_at = nowIso();
    notes.push(note);
  }
  await kvSet(sql, "notes", notes);
  return notes;
}
export async function deleteNote(sql: Sql, noteId: string): Promise<Dict[]> {
  const notes = (await kvGet<Dict[]>(sql, "notes", [])).filter((n) => n.id !== noteId);
  await kvSet(sql, "notes", notes);
  return notes;
}

// ── planner ─────────────────────────────────────────────────────────────────
export async function savePlanner(
  sql: Sql,
  month: string,
  daysOff: number[],
  budgets: Dict,
) {
  const all = await kvGet<Dict>(sql, "planner_data", {});
  const entry = { days_off: [...new Set(daysOff)].sort((a, b) => a - b), budgets };
  all[month] = entry;
  await kvSet(sql, "planner_data", all);
  return entry;
}

// ── balance ─────────────────────────────────────────────────────────────────
// `*_manual` flags mark a card as manually overridden; when false the UI shows
// the auto value (live account balance / derived diff), when true the saved
// amount persists.
export const BALANCE_KEYS = [
  "savings",
  "monzo",
  "chase",
  "barclays",
  "amex",
  "diff_in_bills",
  "diff_in_bills_manual",
  "monzo_manual",
  "chase_manual",
  "barclays_manual",
  "amex_manual",
];
export async function saveBalance(sql: Sql, month: string, values: Dict) {
  const all = await kvGet<Dict>(sql, "balance_data", {});
  const saved: Dict = {};
  for (const k of BALANCE_KEYS) {
    saved[k] = k.endsWith("_manual") ? Boolean(values[k]) : values[k] ?? 0;
  }
  all[month] = saved;
  await kvSet(sql, "balance_data", all);
  return saved;
}

/**
 * Live per-account balances (updated daily by an external job). Positive for
 * debit accounts, negative for the AMEX credit card. Keyed by source.
 */
export async function loadAccountBalances(sql: Sql): Promise<Dict> {
  const rows = (await sql`SELECT source, balance FROM account_balances`) as {
    source: string;
    balance: number;
  }[];
  const out: Dict = {};
  for (const r of rows) out[r.source] = Number(r.balance ?? 0);
  return out;
}

// ── worksheet ───────────────────────────────────────────────────────────────
export async function saveWorksheet(sql: Sql, doc: Dict) {
  await kvSet(sql, "worksheet", doc);
  return doc;
}

// ── repayment categories ────────────────────────────────────────────────────
export async function addRepaymentCategory(sql: Sql, name: string): Promise<string[]> {
  name = (name ?? "").trim();
  const categories = await kvGet<string[]>(sql, "repayment_categories", ["Savings"]);
  if (name && !categories.includes(name)) {
    categories.push(name);
    await kvSet(sql, "repayment_categories", categories);
  }
  return categories;
}

// ── repayment flags / deleted (kv) ──────────────────────────────────────────
export const loadRepaymentFlags = (sql: Sql) =>
  kvGet<Dict>(sql, "scheduled_repayment_flags", {});
export const saveRepaymentFlags = (sql: Sql, flags: Dict) =>
  kvSet(sql, "scheduled_repayment_flags", flags);
export const loadDeletedRepayments = (sql: Sql) =>
  kvGet<string[]>(sql, "deleted_repayments", []);
export async function addDeletedRepayment(sql: Sql, rid: string) {
  const deleted = await loadDeletedRepayments(sql);
  if (!deleted.includes(rid)) {
    deleted.push(rid);
    await kvSet(sql, "deleted_repayments", deleted);
  }
  return deleted;
}
export async function removeDeletedRepayment(sql: Sql, rid: string) {
  const deleted = (await loadDeletedRepayments(sql)).filter((d) => d !== rid);
  await kvSet(sql, "deleted_repayments", deleted);
  return deleted;
}
export async function setRepaymentFlag(
  sql: Sql,
  rid: string,
  category: string | null,
  notes: string | null,
  refunded: boolean | null,
) {
  const flags = await loadRepaymentFlags(sql);
  const entry = flags[rid] ?? {};
  if (category != null) entry.category = category;
  if (notes != null) entry.notes = notes;
  if (refunded != null) entry.refunded = Boolean(refunded);
  flags[rid] = entry;
  await saveRepaymentFlags(sql, flags);
  return entry;
}

// ── hidden transactions (per month, synced across devices via Neon) ─────────
export const loadHidden = (sql: Sql) =>
  kvGet<Record<string, string[]>>(sql, "hidden_transactions", {});

export async function saveHiddenMonth(sql: Sql, month: string, ids: string[]) {
  const all = await loadHidden(sql);
  if (ids.length) all[month] = ids;
  else delete all[month];
  await kvSet(sql, "hidden_transactions", all);
  return all;
}
