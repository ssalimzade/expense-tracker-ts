import { Hono } from "hono";
import { getSql, type Env } from "../lib/db";
import { kvGet, kvSet, kvKeysWithPrefix } from "../lib/kv";
import {
  saveBudgetForMonth,
  loadRules,
  saveRules,
  unpinRule,
  getFlagsForMonth,
  setFlagsForMonth,
  upsertSavingsRow,
  upsertProjectionRow,
  upsertRemunerationRow,
  deleteRemunerationRow,
  loadRentData,
  upsertRentMonth,
  upsertRentPot,
  upsertNote,
  deleteNote,
  savePlanner,
  saveBalance,
  loadAccountBalances,
  saveWorksheet,
  addRepaymentCategory,
  addDeletedRepayment,
  removeDeletedRepayment,
  setRepaymentFlag,
  loadHidden,
  saveHiddenMonth,
} from "../lib/config";
import { subcategoryToCategory, categorizeRow, type Rules } from "../lib/categorize";
import {
  serializeTransactions,
  fetchFlexRows,
  serializeRepayments,
  updateFlexRepayment,
  repaymentId,
  reconcileRent,
  requisitionStatus,
} from "../lib/transactions";
import {
  listSynthetic,
  syncMonth,
  deleteMonth,
  autoSyncCurrent,
} from "../lib/synthetic";

// Worker bindings: the Neon URL plus the static-assets fetcher (the built SPA).
type Bindings = Env & { ASSETS: Fetcher };

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");
const sqlOf = (c: any) => getSql(c.env);

const BALANCE_DEFAULTS = {
  savings: 0,
  monzo: 0,
  chase: 0,
  hsbc: 0,
  amex: 0,
  diff_in_bills: 0,
  diff_in_bills_manual: false,
  monzo_manual: false,
  chase_manual: false,
  hsbc_manual: false,
  amex_manual: false,
};
const MONTH_RE = /^\d{4}-\d{2}$/;
const MAIN_CATEGORIES = [
  "Groceries", "Lunch", "Social Life", "Shopping", "Sports",
  "Transport", "Mobile", "Barber", "Other", "Travel",
];
const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Requisition status ──────────────────────────────────────────────────────
app.get("/requisition-status", async (c) => c.json(await requisitionStatus(sqlOf(c))));

// ── Transactions ────────────────────────────────────────────────────────────
app.get("/transactions", async (c) => {
  const month = c.req.query("month") || undefined;
  return c.json(await serializeTransactions(sqlOf(c), month));
});

app.post("/transactions/:flag_id/flag", async (c) => {
  const flagId = c.req.param("flag_id");
  const b = await c.req.json();
  const monthFlags = await getFlagsForMonth(sqlOf(c), b.month);
  const entry = monthFlags[flagId] ?? {};
  if (b.notes != null) entry.notes = b.notes;
  if (b.subcategory != null) entry.subcategory = b.subcategory;
  if (b.one_time != null) entry.one_time = b.one_time;
  monthFlags[flagId] = entry;
  await setFlagsForMonth(sqlOf(c), b.month, monthFlags);

  // One-time says this row's category is an exception, so the merchant must not
  // stay pinned to it. Ticking the box before picking the category is the plain
  // case — no rule is ever written. Ticking it afterwards has to undo the rule
  // that change left behind, which is what this does: only while the rule still
  // says what this row says, since one reading anything else was set from a
  // different row and is none of this row's business.
  if (b.one_time === true && entry.subcategory && b.description) {
    await unpinRule(sqlOf(c), String(b.description), entry.subcategory);
  }
  return c.json({ flag_id: flagId, month: b.month, ...entry });
});

app.delete("/transactions/:flag_id/flag", async (c) => {
  const flagId = c.req.param("flag_id");
  const month = c.req.query("month") as string;
  const monthFlags = await getFlagsForMonth(sqlOf(c), month);
  delete monthFlags[flagId];
  await setFlagsForMonth(sqlOf(c), month, monthFlags);
  return c.json({ flag_id: flagId, month, deleted: true });
});

// ── Budgets ─────────────────────────────────────────────────────────────────
app.get("/budgets/all", async (c) => c.json(await kvGet(sqlOf(c), "budgets", {})));

app.get("/budgets", async (c) => {
  const month = c.req.query("month") ?? "";
  const all = await kvGet<Record<string, unknown>>(sqlOf(c), "budgets", {});
  return c.json({ month, budgets: all[month] ?? {} });
});

app.post("/budgets/:month", async (c) => {
  const month = c.req.param("month");
  const b = await c.req.json();
  await saveBudgetForMonth(sqlOf(c), month, b.budgets);
  return c.json({ month, budgets: b.budgets });
});

// ── Category rules ──────────────────────────────────────────────────────────
app.get("/category-rules", async (c) => c.json(await loadRules(sqlOf(c))));

app.post("/category-rules", async (c) => {
  const b = await c.req.json();
  const description = String(b.description ?? "").trim();
  const subcategory = String(b.subcategory ?? "");
  if (!description) return c.json({ detail: "description is required" }, 400);
  const rules = (await loadRules(sqlOf(c))) as Rules;
  // A rule pins one exact spelling, and banks send a merchant under several.
  // Storing one that only repeats what the keyword list already says is how a
  // single shop ends up split across categories: the spellings the keywords
  // cover stay right while the pinned one follows a rule that has drifted. So
  // a rule is kept only where it actually changes the answer — and re-saving a
  // row the keywords now get right clears the stale rule instead.
  const byKeyword = categorizeRow(description, {});

  // An empty sub-category means the row was cleared back to Uncategorized, so
  // the remembered rule is dropped rather than stored as a blank mapping.
  //
  // `since` is what keeps the rule off the rows already on screen: it applies
  // to transactions that arrive from now on, and to older rows only where the
  // keyword lists have nothing to say. Re-saving refreshes it, so a rule never
  // reaches further back than the moment it was last chosen.
  if (subcategory && subcategory !== byKeyword) {
    rules[description] = { subcategory, since: new Date().toISOString().slice(0, 19) };
  } else delete rules[description];
  await saveRules(sqlOf(c), rules);
  return c.json({
    description,
    subcategory,
    category: subcategoryToCategory[subcategory] ?? "Uncategorized",
  });
});

// ── Repayments (Flex) ───────────────────────────────────────────────────────
app.get("/repayments", async (c) => {
  // On first load of a new month, push that month's repayments so they count as
  // spend on the dashboard (idempotent — guarded by a marker).
  await autoSyncCurrent(sqlOf(c));
  return c.json(await serializeRepayments(sqlOf(c), await fetchFlexRows(sqlOf(c))));
});

app.post("/repayments", async (c) => {
  const b = await c.req.json();
  const raw: Record<string, any> = {
    repayment_1_date: b.repayment_1_date && b.repayment_1_date !== "" ? b.repayment_1_date : null,
    repayment_1_amount: b.repayment_1_amount ?? null,
    repayment_2_date: b.repayment_2_date && b.repayment_2_date !== "" ? b.repayment_2_date : null,
    repayment_2_amount: b.repayment_2_amount ?? null,
    repayment_3_date: b.repayment_3_date && b.repayment_3_date !== "" ? b.repayment_3_date : null,
    repayment_3_amount: b.repayment_3_amount ?? null,
  };
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(raw)) if (v != null) fields[k] = v;

  const tx = await updateFlexRepayment(sqlOf(c), b.flex_id, fields);
  if (!tx) return c.json({ detail: "Flex transaction not found" }, 404);

  const rid = await repaymentId(tx.description ?? "", tx.created_iso ?? "");
  if (b.category != null || b.notes != null || b.refunded != null) {
    await setRepaymentFlag(sqlOf(c), rid, b.category ?? null, b.notes ?? null, b.refunded ?? null);
  }
  const rows = await serializeRepayments(sqlOf(c), [tx]);
  return c.json(rows[0]);
});

// Synthetic (manual) Monzo rows generated from the repayment amounts.
app.get("/repayments/synthetic", async (c) => c.json(await listSynthetic(sqlOf(c))));
app.post("/repayments/synthetic/sync", async (c) => {
  const b = await c.req.json();
  return c.json(await syncMonth(sqlOf(c), b.month));
});
app.delete("/repayments/synthetic/:month", async (c) => {
  await deleteMonth(sqlOf(c), c.req.param("month"));
  return c.json({ month: c.req.param("month"), deleted: true });
});

app.get("/repayment-categories", async (c) =>
  c.json(await kvGet(sqlOf(c), "repayment_categories", ["Savings"])),
);
app.post("/repayment-categories", async (c) => {
  const b = await c.req.json();
  return c.json(await addRepaymentCategory(sqlOf(c), b.name));
});

app.delete("/repayments/:rid", async (c) => {
  const rid = c.req.param("rid");
  await addDeletedRepayment(sqlOf(c), rid);
  return c.json({ id: rid, deleted: true });
});
app.post("/repayments/:rid/restore", async (c) => {
  const rid = c.req.param("rid");
  await removeDeletedRepayment(sqlOf(c), rid);
  return c.json({ id: rid, restored: true });
});

// ── Savings ─────────────────────────────────────────────────────────────────
app.get("/savings", async (c) => c.json(await kvGet(sqlOf(c), "savings_data", [])));
app.post("/savings", async (c) => {
  const b = await c.req.json();
  const row = {
    start_date: b.start_date,
    end_date: b.end_date ?? null,
    starting_balance: b.starting_balance ?? 0,
    home_contributions: b.home_contributions ?? 0,
    savings: b.savings ?? 0,
    adjustments: b.adjustments ?? 0,
    investments: b.investments ?? 0,
    adjustment_notes: b.adjustment_notes ?? "",
  };
  return c.json(await upsertSavingsRow(sqlOf(c), row));
});

// ── Projections ─────────────────────────────────────────────────────────────
app.get("/projections", async (c) => c.json(await kvGet(sqlOf(c), "projections_data", [])));
app.post("/projections", async (c) => {
  const b = await c.req.json();
  const row = {
    month: b.month,
    salary: b.salary ?? 0,
    bonus: b.bonus ?? 0,
    monthly_costs: b.monthly_costs ?? 0,
    housing_costs: b.housing_costs ?? 0,
    home_contributions: b.home_contributions ?? 0,
    savings: b.savings ?? 0,
    investments: b.investments ?? 0,
    other_pl: b.other_pl ?? 0,
    notes: b.notes ?? "",
  };
  return c.json(await upsertProjectionRow(sqlOf(c), row));
});

// ── Rent ────────────────────────────────────────────────────────────────────
app.get("/rent", async (c) => {
  const year = c.req.query("year") ? Number(c.req.query("year")) : new Date().getFullYear();
  const data = await loadRentData(sqlOf(c));
  data.reconciled = await reconcileRent(sqlOf(c), year);
  return c.json(data);
});
app.post("/rent", async (c) => {
  const b = await c.req.json();
  const entry: Record<string, any> = {};
  for (const [k, v] of Object.entries(b.entry ?? {})) {
    const item = v as any;
    entry[k] = {
      amount: item.amount ?? 0,
      paid: item.paid ?? false,
      // Null means "paid what was allocated" — kept distinct from a real £0.
      paid_amount: item.paid_amount ?? null,
      // The slice someone else covers. Null (not 0) means "not split", so the
      // cell keeps tracking the bill on its own.
      contribution: item.contribution ?? null,
      unlinked: item.unlinked ?? false,
    };
  }
  return c.json(await upsertRentMonth(sqlOf(c), b.month, entry));
});

app.post("/rent/pot", async (c) => {
  const b = await c.req.json();
  const settlements = (Array.isArray(b.settlements) ? b.settlements : [])
    .filter((s: any) => MONTH_RE.test(String(s?.month ?? "")))
    .map((s: any) => ({
      month: String(s.month),
      bill: round2(Number(s.bill) || 0),
      note: String(s.note ?? ""),
    }));
  return c.json(await upsertRentPot(sqlOf(c), String(b.key), settlements));
});

// ── Remuneration ────────────────────────────────────────────────────────────
app.get("/remuneration", async (c) => c.json(await kvGet(sqlOf(c), "remuneration_data", [])));
app.post("/remuneration", async (c) => {
  const b = await c.req.json();
  // Null on a derived field means "use the calculated value" — kept distinct
  // from a real 0, so these can't be defaulted away.
  const num = (v: any) => (v == null || v === "" ? null : Number(v));
  const row = {
    period: String(b.period ?? "").trim() || "Untitled",
    gross: b.gross ?? 0,
    bonus: b.bonus ?? 0,
    pension_pct: b.pension_pct ?? 0,
    current: b.current ?? false,
    deductions: num(b.deductions),
    pension: num(b.pension),
    net_pa: num(b.net_pa),
    net_pm: num(b.net_pm),
  };
  const original = b.original_period ? String(b.original_period) : undefined;
  const index = Number.isInteger(b.index) ? Number(b.index) : undefined;
  return c.json(await upsertRemunerationRow(sqlOf(c), row, original, index));
});
app.delete("/remuneration/:period", async (c) =>
  c.json(await deleteRemunerationRow(sqlOf(c), decodeURIComponent(c.req.param("period")))),
);

// ── Archive ─────────────────────────────────────────────────────────────────
app.get("/archive", async (c) => {
  const keys = await kvKeysWithPrefix(sqlOf(c), "archive:");
  const months = keys.map((k) => k.split(":")[1]).filter((m) => MONTH_RE.test(m)).sort();
  return c.json(months);
});

app.get("/archive/:month", async (c) => {
  const month = c.req.param("month");
  const data = await kvGet(sqlOf(c), `archive:${month}`, null);
  if (data === null) return c.json({ detail: `No archive for ${month}` }, 404);
  return c.json(data);
});

app.post("/archive/:month", async (c) => {
  const month = c.req.param("month");
  const body = (await c.req.json()) as any[];
  await kvSet(sqlOf(c), `archive:${month}`, body);
  return c.json({ month, rows: body.length });
});

app.post("/archive/:month/recompute", async (c) => {
  const month = c.req.param("month");
  const txns = await serializeTransactions(sqlOf(c), month);
  const raw: Record<string, number> = {};
  for (const t of txns) {
    const cat = t.category;
    if (cat === "Uncategorized" || cat === "Rent & Utilities") continue;
    raw[cat] = (raw[cat] ?? 0) + t.amount;
  }
  const budgets = ((await kvGet<Record<string, any>>(sqlOf(c), "budgets", {}))[month]) ?? {};
  const archiveRows = MAIN_CATEGORIES.map((cat) => {
    const s = raw[cat] ?? 0;
    const spent = s < 0 ? round2(-s) : 0.0;
    const budget = budgets[cat] ?? 0;
    return {
      Category: cat,
      "Budget (£)": budget,
      "Spent (£)": spent,
      "Remaining (£)": round2(budget - spent),
    };
  });
  await kvSet(sqlOf(c), `archive:${month}`, archiveRows);
  return c.json(null);
});

// ── Balance ─────────────────────────────────────────────────────────────────
// Live per-account balances (auto-fetched default for the balance cards).
app.get("/account-balances", async (c) => c.json(await loadAccountBalances(sqlOf(c))));
app.get("/balance/:month", async (c) => {
  const month = c.req.param("month");
  const all = await kvGet<Record<string, any>>(sqlOf(c), "balance_data", {});
  return c.json({ month, ...BALANCE_DEFAULTS, ...(all[month] ?? {}) });
});
app.put("/balance/:month", async (c) => {
  const month = c.req.param("month");
  const b = await c.req.json();
  const saved = await saveBalance(sqlOf(c), month, b);
  return c.json({ month, ...saved });
});

// ── Planner ─────────────────────────────────────────────────────────────────
app.get("/planner", async (c) => c.json(await kvGet(sqlOf(c), "planner_data", {})));
app.get("/planner/:month", async (c) => {
  const month = c.req.param("month");
  const all = await kvGet<Record<string, any>>(sqlOf(c), "planner_data", {});
  const e = all[month];
  return c.json({ month, days_off: e?.days_off ?? [], budgets: e?.budgets ?? {} });
});
app.put("/planner/:month", async (c) => {
  const month = c.req.param("month");
  const b = await c.req.json();
  const saved = await savePlanner(sqlOf(c), month, b.days_off ?? [], b.budgets ?? {});
  return c.json({ month, ...saved });
});

// ── Notes ───────────────────────────────────────────────────────────────────
app.get("/notes", async (c) => c.json(await kvGet(sqlOf(c), "notes", [])));
app.post("/notes", async (c) => c.json(await upsertNote(sqlOf(c), await c.req.json())));
app.delete("/notes/:note_id", async (c) =>
  c.json(await deleteNote(sqlOf(c), c.req.param("note_id"))),
);

// ── Worksheet ───────────────────────────────────────────────────────────────
app.get("/worksheet", async (c) => c.json(await kvGet(sqlOf(c), "worksheet", { data: [] })));
app.put("/worksheet", async (c) => {
  const b = await c.req.json();
  return c.json(await saveWorksheet(sqlOf(c), { data: b.data ?? [] }));
});

// ── Hidden transactions (per month) ─────────────────────────────────────────
app.get("/hidden", async (c) => c.json(await loadHidden(sqlOf(c))));
app.put("/hidden/:month", async (c) => {
  const month = c.req.param("month");
  const ids = (await c.req.json()) as string[];
  return c.json(await saveHiddenMonth(sqlOf(c), month, ids));
});

// Workers entry: /api/* → Hono; everything else → static SPA assets.
export default {
  async fetch(request: Request, env: Bindings, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api")) {
      return app.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
};
