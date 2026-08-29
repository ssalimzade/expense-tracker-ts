# expense-tracker-ts

TypeScript port of the personal finance dashboard, running as a single
**Cloudflare Worker** (Hono) that serves the built React SPA as static assets and
reads the same **Neon Postgres** database (transactions + the `app_config` config
table). Goal: $0/month, always-on (no cold starts), gated by Cloudflare Access.

The original Python app (`../expense-tracker`) stays runnable as a reference
oracle for the routes it still shares.

## Architecture

```
Cloudflare Worker  (wrangler.toml → worker/index.ts)
├── /api/*        → Hono app (45 routes)
└── everything else → [assets] binding: the SPA Vite builds into dist/
        ↓ @neondatabase/serverless (HTTP)
   Neon Postgres  (transaction tables + app_config)
Cloudflare Access → gates the whole site (free, email login)
```

## Layout

| Path | What |
|---|---|
| `src/` | React frontend (calls `/api/*`) |
| `worker/index.ts` | Hono app — every API route under `/api`, plus the static-asset fallthrough |
| `lib/` | Server-side logic shared by the routes: the categoriser, transaction serialisation, `app_config` access |
| `lib/db.ts` | Neon serverless client |
| `lib/kv.ts` | `app_config` key-value access (mirrors the Python `kv.py`) |
| `wrangler.toml` | Worker + static-assets config |

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
npm run dev            # Vite on :5173 — SPA only (proxies /api elsewhere, below)
npm run wdev           # build the SPA, then wrangler dev — Worker + /api together
npm run build          # tsc -b, then build the SPA into dist/
```

`wrangler dev` reads `DATABASE_URL` from `.dev.vars` (gitignored — never
committed). `npm run dev` serves the SPA only: it proxies `/api` to the Python
app on `:8000` (see `vite.config.ts`), so use `wdev` to run against this repo's
own routes.

## Deploy (Cloudflare)

```bash
npx wrangler secret put DATABASE_URL   # once per environment
npm run deploy                         # build, then wrangler deploy
```

Cloudflare Access gates the deployed Worker (free, email login) — set up once in
the Cloudflare dashboard, not from this repo.

## Port status — ✅ complete

All 40 routes of the Python app were ported and verified **byte-identical** by
running both against the same Neon DB and diffing responses:

- 20 read routes (config + DB: transactions/categorization/`flag_id`, repayments,
  rent reconcile, requisition status).
- 15 write routes (verified with snapshot → run-both → restore, zero net change).
- Synthetic repayments: `list` + force-resync (category totals match).

Since then the Worker has been deployed and gated by Access, mobile card layouts
have landed, and the app has grown past the Python original — 45 routes now, and
behaviour (the `since` stamp on merchant rules, One-time as a per-row exception)
that the oracle cannot be diffed against any more.
