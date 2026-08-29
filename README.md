# expense-tracker-ts

TypeScript / Cloudflare Pages port of the personal finance dashboard. It replaces
the Python/FastAPI backend with **Cloudflare Pages Functions** (Hono), reading the
same **Neon Postgres** database (transactions + the `app_config` config table).
Goal: $0/month, always-on (no cold starts), gated by Cloudflare Access.

The original Python app (`../expense-tracker`) stays runnable as a reference oracle
until this port is fully verified route-by-route.

## Architecture

```
Cloudflare Pages project
├── React SPA (static, built by Vite)  → served from /
└── functions/api/[[route]].ts (Hono)  → serves /api/*
        ↓ @neondatabase/serverless (HTTP)
   Neon Postgres  (transaction tables + app_config)
Cloudflare Access → gates the whole site (free, email login)
```

## Layout

| Path | What |
|---|---|
| `src/` | React frontend (copied from the Python repo; calls `/api/*`) |
| `functions/api/[[route]].ts` | Hono app — all API routes under `/api` |
| `lib/db.ts` | Neon serverless client |
| `lib/kv.ts` | `app_config` key-value access (mirrors the Python `kv.py`) |
| `wrangler.toml` | Pages config |

## Categorising

A row's category is not stored on the transaction — it is worked out on every
read (`serializeTransactions` in `lib/transactions.ts`) from three sources, in
this order:

1. **The row's own override** — the category picked on that one line, stored
   against its `flag_id`. Beats everything else; the ↺ beside the dropdown drops
   it and hands the row back to the categoriser.
2. **Merchant rules** (`app_config.category_rules`) — a description pinned to a
   sub-category, saved whenever a category is picked, so the same merchant maps
   itself next time it comes in. A rule is only stored where it disagrees with
   the keyword lists; re-saving a row the keywords now get right clears it.
3. **Keyword lists** — `subCategoryKeywords` and `rentSubcategoryKeywords` in
   `lib/categorize.ts`, matched as whole words against the description and the
   merchant name, with punctuation treated as a separator so "CO-OP", "CO- OP"
   and "Co Op" all match.

Each rule carries `since`, the moment it was saved, and outranks the keyword
lists only for transactions that arrived after that. On older rows it can fill a
gap the keywords leave — so categorising one Uncategorized row still catches its
siblings — but never overwrite an answer they already gave. Without that, one
rule reached backwards and re-categorised rows already on screen.

`flag_id` identifies one transaction: a hash of description + `created`, with
duplicates (two visits to the same shop on a day, which HSBC stamps identically)
separated by the bank's own row id.

### One-time

Ticking **One-time** says this row is an exception rather than a new answer for
the merchant:

- Picking a category on a one-time row writes the per-row override and **no
  merchant rule** — that CO-OP visit becomes Other while every other CO-OP line
  keeps Groceries.
- Ticking the box *after* changing the category unpins the rule that change
  wrote, so either order gives the same result. Only a rule that still says what
  the row says is unpinned; one reading anything else was set from a different
  row and is left alone.
- The row is also kept out of its category's average in the anomaly highlighter,
  so a one-off does not make the rest of the category look normal.

It does not affect spend totals, budgets or projections — one-time rows count as
spend like any other (`src/lib/spend.ts`).

## Local dev

```bash
npm install
npm run build          # build the SPA into dist/
npm run pages:dev      # wrangler serves dist/ + functions on :8788
```

Local dev reads `DATABASE_URL` from `.dev.vars` (gitignored — never committed).

## Deploy (Cloudflare)

1. Connect this repo to Cloudflare Pages (build: `npm run build`, output: `dist`).
2. Set `DATABASE_URL` as a Pages secret.
3. Enable Cloudflare Access on the project.

## Port status — ✅ complete

All 40 routes ported and verified **byte-identical to the Python app** by running
both against the same Neon DB and diffing responses:

- 20 read routes (config + DB: transactions/categorization/`flag_id`, repayments,
  rent reconcile, requisition status).
- 15 write routes (verified with snapshot → run-both → restore, zero net change).
- Synthetic repayments: `list` + force-resync (category totals match).

Not yet done: the Cloudflare **deploy** (connect repo to Pages, set `DATABASE_URL`
secret, enable Access) and mobile/responsive polish.
