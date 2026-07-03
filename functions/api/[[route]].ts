import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";
import { getSql, type Env } from "../../lib/db";
import { kvGet, kvKeysWithPrefix } from "../../lib/kv";

// All API routes live under /api (matching the frontend's fetch base). The
// Python backend served these at root; here Hono's basePath adds the /api prefix
// that the Vite dev proxy used to strip.
const app = new Hono<{ Bindings: Env }>().basePath("/api");

const BALANCE_DEFAULTS = {
  savings: 0,
  monzo: 0,
  chase: 0,
  barclays: 0,
  amex: 0,
  diff_in_bills: 0,
};
const MONTH_RE = /^\d{4}-\d{2}$/;

// ── Config reads (app_config / kv) ──────────────────────────────────────────

app.get("/budgets/all", async (c) =>
  c.json(await kvGet(getSql(c.env), "budgets", {})),
);

app.get("/budgets", async (c) => {
  const month = c.req.query("month") ?? "";
  const all = await kvGet<Record<string, unknown>>(getSql(c.env), "budgets", {});
  return c.json({ month, budgets: all[month] ?? {} });
});

app.get("/category-rules", async (c) =>
  c.json(await kvGet(getSql(c.env), "category_rules", {})),
);

app.get("/repayment-categories", async (c) =>
  c.json(await kvGet(getSql(c.env), "repayment_categories", ["Savings"])),
);

app.get("/savings", async (c) =>
  c.json(await kvGet(getSql(c.env), "savings_data", [])),
);

app.get("/projections", async (c) =>
  c.json(await kvGet(getSql(c.env), "projections_data", [])),
);

app.get("/remuneration", async (c) =>
  c.json(await kvGet(getSql(c.env), "remuneration_data", [])),
);

app.get("/notes", async (c) => c.json(await kvGet(getSql(c.env), "notes", [])));

app.get("/worksheet", async (c) =>
  c.json(await kvGet(getSql(c.env), "worksheet", { data: [] })),
);

app.get("/planner", async (c) =>
  c.json(await kvGet(getSql(c.env), "planner_data", {})),
);

app.get("/planner/:month", async (c) => {
  const month = c.req.param("month");
  const all = await kvGet<Record<string, any>>(getSql(c.env), "planner_data", {});
  const e = all[month];
  return c.json({ month, days_off: e?.days_off ?? [], budgets: e?.budgets ?? {} });
});

app.get("/balance/:month", async (c) => {
  const month = c.req.param("month");
  const all = await kvGet<Record<string, any>>(getSql(c.env), "balance_data", {});
  return c.json({ month, ...BALANCE_DEFAULTS, ...(all[month] ?? {}) });
});

app.get("/archive", async (c) => {
  const keys = await kvKeysWithPrefix(getSql(c.env), "archive:");
  const months = keys
    .map((k) => k.split(":")[1])
    .filter((m) => MONTH_RE.test(m))
    .sort();
  return c.json(months);
});

app.get("/archive/:month", async (c) => {
  const month = c.req.param("month");
  const data = await kvGet(getSql(c.env), `archive:${month}`, null);
  if (data === null) return c.json({ detail: `No archive for ${month}` }, 404);
  return c.json(data);
});

export const onRequest = handle(app);
