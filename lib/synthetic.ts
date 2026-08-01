import type { Sql } from "./db";
import { kvGet, kvSet } from "./kv";
import { makeTransactionId } from "./hash";
import { fetchFlexRows } from "./transactions";
import { loadRepaymentFlags, loadDeletedRepayments } from "./config";

// Port of services/synthetic_repayments.py — synthetic Monzo rows that make Flex
// repayments show up as monthly spend on the dashboard.

type Row = Record<string, any>;
const MANUAL_ID_PREFIX = "tx_created_";
const DEFAULT_BUDGET_CATEGORIES = [
  "Groceries", "Lunch", "Social Life", "Shopping", "Sports",
  "Transport", "Mobile", "Barber", "Other", "Travel",
];
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

// isoformat of created (second precision here — synthetic rows are dated the 1st).
const ISO_CREATED =
  `CASE WHEN to_char(created,'US')='000000' ` +
  `THEN to_char(created,'YYYY-MM-DD"T"HH24:MI:SS') ` +
  `ELSE to_char(created,'YYYY-MM-DD"T"HH24:MI:SS.US') END`;

const loadMarker = (sql: Sql) => kvGet<Record<string, string[]>>(sql, "synthetic_repayments", {});
const saveMarker = (sql: Sql, m: Record<string, string[]>) => kvSet(sql, "synthetic_repayments", m);

async function budgetCategories(sql: Sql, month: string): Promise<Set<string>> {
  const budgets = await kvGet<Record<string, any>>(sql, "budgets", {});
  const b = budgets[month];
  const keys = b && Object.keys(b).length ? Object.keys(b) : DEFAULT_BUDGET_CATEGORIES;
  return new Set(keys.filter((k) => k !== "Savings"));
}

async function getMaxManualSeq(sql: Sql): Promise<number> {
  const rows = await sql.query(
    `SELECT id FROM monzo_transactions WHERE id LIKE '${MANUAL_ID_PREFIX}%'`,
    [],
  );
  let max = 0;
  for (const r of rows) {
    const suffix = String(r.id).replace(MANUAL_ID_PREFIX, "");
    if (/^\d+$/.test(suffix)) max = Math.max(max, parseInt(suffix, 10));
  }
  return max;
}

async function getMonzoByIds(sql: Sql, ids: string[]): Promise<Row[]> {
  if (!ids.length) return [];
  return sql.query(
    `SELECT id, ${ISO_CREATED} AS created_iso, description, amount ` +
      `FROM monzo_transactions WHERE id = ANY($1)`,
    [ids],
  );
}

async function deleteMonzoByIds(sql: Sql, ids: string[]): Promise<void> {
  if (!ids.length) return;
  await sql.query(`DELETE FROM monzo_transactions WHERE id = ANY($1)`, [ids]);
}

export async function categoryTotals(sql: Sql, month: string): Promise<Record<string, number>> {
  const flags = await loadRepaymentFlags(sql);
  const deleted = new Set(await loadDeletedRepayments(sql));
  const eligible = await budgetCategories(sql, month);

  const totals: Record<string, number> = {};
  for (const t of await fetchFlexRows(sql)) {
    if (t.description === "Flex") continue;
    const rid = await makeTransactionId(t.description ?? "", t.created_iso ?? "");
    if (deleted.has(rid)) continue;
    const category = flags[rid]?.category ?? "";
    if (!eligible.has(category)) continue;
    const splits: [any, any][] = [
      [t.r1d, t.r1a],
      [t.r2d, t.r2a],
      [t.r3d, t.r3a],
    ];
    for (const [date, amount] of splits) {
      if (!date || !amount) continue;
      if (String(date).slice(0, 7) !== month) continue;
      totals[category] = (totals[category] ?? 0) + Math.abs(amount);
    }
  }
  const out: Record<string, number> = {};
  for (const [c, v] of Object.entries(totals)) if (v) out[c] = round2(v);
  return out;
}

export async function listSynthetic(sql: Sql): Promise<Row[]> {
  const marker = await loadMarker(sql);
  const idToMonth: Record<string, string> = {};
  for (const [month, ids] of Object.entries(marker)) for (const rid of ids) idToMonth[rid] = month;
  const rows = await getMonzoByIds(sql, Object.keys(idToMonth));
  const out = rows.map((r) => ({
    id: r.id,
    month: idToMonth[r.id],
    created: r.created_iso,
    category: r.description,
    amount: r.amount,
  }));
  out.sort((a, b) => cmp(a.month ?? "", b.month ?? "") || cmp(a.category ?? "", b.category ?? ""));
  return out;
}

/**
 * Rebuild a month's synthetic rows from its repayment totals as they stand now.
 * Always recomputes — any rows from an earlier sync are dropped first — so a
 * month whose repayments have changed since picks up the new figures.
 */
export async function syncMonth(sql: Sql, month: string): Promise<Row[]> {
  const marker = await loadMarker(sql);
  if (month in marker) {
    await deleteMonzoByIds(sql, marker[month]);
    delete marker[month];
  }

  const totals = await categoryTotals(sql, month);
  const created = `${month}-01 00:00:00`;
  const pulledAt = new Date().toISOString().replace("T", " ").replace("Z", "");
  let seq = await getMaxManualSeq(sql);

  const ids: string[] = [];
  const entries = Object.entries(totals).sort((a, b) => cmp(a[0], b[0]));
  for (const [category, total] of entries) {
    seq += 1;
    const id = `${MANUAL_ID_PREFIX}${String(seq).padStart(6, "0")}`;
    await sql.query(
      `INSERT INTO monzo_transactions ` +
        `(id, created, description, amount, currency, merchant_name, status, pulled_at, source) ` +
        `VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, created, category, -Math.abs(total), "GBP", "manual", "booked", pulledAt, "monzo"],
    );
    ids.push(id);
  }

  // A month that pushed nothing is left unmarked: recording it would read as
  // "already done" and stop the month from ever being pushed once repayments
  // for it are categorised.
  if (ids.length) marker[month] = ids;
  await saveMarker(sql, marker);
  return listSynthetic(sql);
}

// The user's month, not the worker's. `toISOString()` is UTC, so through BST the
// month rolls over an hour late and the 1st's push would be skipped until 01:00
// local — for a month whose rows are dated the 1st, that is the whole window.
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
});

/** Today's YYYY-MM where the user lives, whatever order the locale prints in. */
function currentMonth(): string {
  const parts = MONTH_FMT.formatToParts(new Date());
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}`;
}

export async function autoSyncCurrent(sql: Sql): Promise<void> {
  const month = currentMonth();
  const marker = await loadMarker(sql);
  // Keyed on rows actually pushed, not on the key existing, so a month left
  // empty by an earlier sync is retried rather than written off as done.
  if (!marker[month]?.length) await syncMonth(sql, month);
}

export async function deleteMonth(sql: Sql, month: string): Promise<void> {
  const marker = await loadMarker(sql);
  if (month in marker) {
    await deleteMonzoByIds(sql, marker[month]);
    delete marker[month];
    await saveMarker(sql, marker);
  }
}
