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

## Port status

- ✅ Foundation (Neon + kv) and read-only config routes — verified byte-identical
  to the Python app via a differential test.
- ⬜ Remaining kv write routes.
- ⬜ DB routes: transactions + categorization, repayments, synthetic rows, rent
  reconcile, archive recompute.
