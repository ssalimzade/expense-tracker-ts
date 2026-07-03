import type { Sql } from "./db";
import { makeTransactionId } from "./hash";
import {
  categorizeOne,
  categorizeRow,
  subcategoryToCategory,
  type Rules,
} from "./categorize";
import {
  loadRules,
  getFlagsForMonth,
  loadRepaymentFlags,
  loadDeletedRepayments,
} from "./config";

type Row = Record<string, any>;

// created formatted like Python strftime("%Y-%m-%dT%H:%M:%S") — second precision.
const CREATED_STRFTIME = `to_char(created,'YYYY-MM-DD"T"HH24:MI:SS')`;

// A column formatted like Python datetime.isoformat(): 6-digit microseconds only
// when nonzero, otherwise omitted.
const iso = (col: string) =>
  `CASE WHEN to_char(${col},'US')='000000' ` +
  `THEN to_char(${col},'YYYY-MM-DD"T"HH24:MI:SS') ` +
  `ELSE to_char(${col},'YYYY-MM-DD"T"HH24:MI:SS.US') END`;

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

// ── Transactions ────────────────────────────────────────────────────────────

const TX_COLS =
  `id, ${CREATED_STRFTIME} AS created_iso, description, amount, currency, ` +
  `merchant_name, status, source`;
const MONTH_TABLES = [
  "monzo_transactions",
  "chase_transactions",
  "amex_transactions",
  "barclays_transactions",
];
const ALL_TABLES = [
  "monzo_transactions",
  "flex_transactions",
  "chase_transactions",
  "amex_transactions",
  "barclays_transactions",
];

async function fetchTxRows(sql: Sql, month?: string): Promise<Row[]> {
  const out: Row[] = [];
  if (month) {
    const [y, m] = month.split("-").map(Number);
    const start = `${month}-01`;
    const end =
      m < 12
        ? `${y}-${String(m + 1).padStart(2, "0")}-01`
        : `${y + 1}-01-01`;
    for (const t of MONTH_TABLES) {
      const rows = await sql.query(
        `SELECT ${TX_COLS} FROM ${t} WHERE created >= $1 AND created < $2`,
        [start, end],
      );
      out.push(...rows);
    }
  } else {
    for (const t of ALL_TABLES) {
      out.push(...(await sql.query(`SELECT ${TX_COLS} FROM ${t}`, [])));
    }
  }
  return out;
}

export async function serializeTransactions(sql: Sql, month?: string): Promise<Row[]> {
  const rows = await fetchTxRows(sql, month);
  const rules = (await loadRules(sql)) as Rules;
  const monthFlags = month ? await getFlagsForMonth(sql, month) : {};

  const result: Row[] = [];
  for (const t of rows) {
    if ((t.description ?? "").trim() === "TFL TRAVEL CHARGE") continue;
    const createdIso: string | null = t.created_iso ?? null;
    const flagId = await makeTransactionId(t.description ?? "", createdIso ?? "");

    let [subcategory, category] = categorizeOne(t.description ?? "", rules);
    const flag = monthFlags[flagId] ?? {};
    if ("subcategory" in flag) {
      subcategory = flag.subcategory;
      category = subcategoryToCategory[subcategory] ?? "Uncategorized";
    }

    result.push({
      id: t.id,
      flag_id: flagId,
      created: createdIso,
      description: t.description,
      amount: t.amount,
      currency: t.currency,
      merchant_name: t.merchant_name,
      status: t.status,
      source: t.source,
      subcategory,
      category,
      notes: "notes" in flag ? flag.notes : "",
      one_time: Boolean("one_time" in flag ? flag.one_time : false),
    });
  }
  // sort by created desc, stable (matches Python sort(reverse=True))
  result.sort((a, b) => cmp(String(b.created ?? ""), String(a.created ?? "")));
  return result;
}

// ── Repayments (Flex) ───────────────────────────────────────────────────────

const FLEX_COLS =
  `id, description, amount, ${iso("created")} AS created_iso, ` +
  `${iso("repayment_1_date")} AS r1d, repayment_1_amount AS r1a, ` +
  `${iso("repayment_2_date")} AS r2d, repayment_2_amount AS r2a, ` +
  `${iso("repayment_3_date")} AS r3d, repayment_3_amount AS r3a`;

export const fetchFlexRows = (sql: Sql) =>
  sql.query(`SELECT ${FLEX_COLS} FROM flex_transactions ORDER BY created DESC`, []);

export async function serializeRepayments(sql: Sql, flexRows: Row[]): Promise<Row[]> {
  const flags = await loadRepaymentFlags(sql);
  const deleted = new Set(await loadDeletedRepayments(sql));

  const out: Row[] = [];
  for (const t of flexRows) {
    const rid = await makeTransactionId(t.description ?? "", t.created_iso ?? "");
    if (deleted.has(rid)) continue;
    const flag = flags[rid] ?? {};
    out.push({
      id: rid,
      flex_id: t.id,
      created: t.created_iso,
      description: t.description,
      amount: t.amount,
      category: "category" in flag ? flag.category : "",
      notes: "notes" in flag ? flag.notes : "",
      refunded: Boolean("refunded" in flag ? flag.refunded : false),
      repayment_1_date: t.r1d,
      repayment_1_amount: t.r1a,
      repayment_2_date: t.r2d,
      repayment_2_amount: t.r2a,
      repayment_3_date: t.r3d,
      repayment_3_amount: t.r3a,
    });
  }
  return out;
}

const FLEX_FIELDS = new Set([
  "repayment_1_date",
  "repayment_1_amount",
  "repayment_2_date",
  "repayment_2_amount",
  "repayment_3_date",
  "repayment_3_amount",
]);

/** Update repayment columns on a flex row; returns the refreshed raw row or null. */
export async function updateFlexRepayment(
  sql: Sql,
  flexId: string,
  fields: Row,
): Promise<Row | null> {
  const sets: string[] = [];
  const params: any[] = [];
  let i = 1;
  for (const [k, v] of Object.entries(fields)) {
    if (!FLEX_FIELDS.has(k)) continue;
    sets.push(`${k} = $${i++}`);
    params.push(v);
  }
  if (sets.length) {
    params.push(flexId);
    const upd = await sql.query(
      `UPDATE flex_transactions SET ${sets.join(", ")} WHERE id = $${i} RETURNING id`,
      params,
    );
    if (!upd.length) return null;
  } else {
    const chk = await sql.query(`SELECT id FROM flex_transactions WHERE id = $1`, [
      flexId,
    ]);
    if (!chk.length) return null;
  }
  const rows = await sql.query(`SELECT ${FLEX_COLS} FROM flex_transactions WHERE id = $1`, [
    flexId,
  ]);
  return rows[0] ?? null;
}

/** repayment_id — sha256(description | isoformat(created)). */
export const repaymentId = (description: string, createdIso: string) =>
  makeTransactionId(description ?? "", createdIso ?? "");

// ── Rent reconcile ──────────────────────────────────────────────────────────

// subcategory -> [rent item key, month offset]
const SUBCAT_TO_RENT_ITEM: Record<string, [string, number]> = {
  Rent: ["flat", 1],
  Energy: ["energy", -1],
  Water: ["water", 0],
  Wifi: ["wifi", 0],
  "Council Tax": ["council_tax", 0],
};

function shiftMonth(yr: number, mo: number, offset: number): string {
  const base = yr * 12 + (mo - 1) + offset;
  const y = Math.floor(base / 12);
  const m = ((base % 12) + 12) % 12;
  return `${String(y).padStart(4, "0")}-${String(m + 1).padStart(2, "0")}`;
}

const RECONCILE_COLS =
  `description, amount, extract(year from created)::int AS yr, ` +
  `extract(month from created)::int AS mo, to_char(created,'YYYY-MM-DD') AS created_date`;

export async function reconcileRent(sql: Sql, year: number): Promise<Row> {
  const rules = (await loadRules(sql)) as Rules;
  const out: Row = {};
  for (const t of ALL_TABLES) {
    const rows = await sql.query(
      `SELECT ${RECONCILE_COLS} FROM ${t} WHERE created IS NOT NULL`,
      [],
    );
    for (const r of rows) {
      if (!r.amount || r.amount >= 0) continue;
      const sub = categorizeRow(r.description ?? "", rules);
      const mapping = SUBCAT_TO_RENT_ITEM[sub];
      if (!mapping) continue;
      const [itemKey, offset] = mapping;
      const targetMonth = shiftMonth(r.yr, r.mo, offset);
      if (!targetMonth.startsWith(String(year))) continue;
      const bucket = (out[targetMonth] ??= {});
      const amount = Math.round(Math.abs(r.amount) * 100) / 100;
      const existing = bucket[itemKey];
      if (existing == null || amount > existing.amount) {
        bucket[itemKey] = { amount, date: r.created_date, description: r.description };
      }
    }
  }
  return out;
}

// ── Requisition status ──────────────────────────────────────────────────────

export async function requisitionStatus(sql: Sql): Promise<Row[]> {
  const rows = await sql.query(
    `SELECT source, ${iso("expires_at")} AS expires_iso, ` +
      `CASE WHEN expires_at IS NULL THEN NULL ` +
      `ELSE floor(extract(epoch from (expires_at - (now() at time zone 'utc'))) / 86400)::int ` +
      `END AS days_left ` +
      `FROM requisition_status`,
    [],
  );
  return rows.map((r) => ({
    source: r.source,
    expires_at: r.expires_iso ?? null,
    days_left: r.days_left ?? null,
  }));
}
