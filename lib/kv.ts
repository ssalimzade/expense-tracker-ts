import type { Sql } from "./db";

// Key-value config store backed by the Postgres `app_config` table. Mirrors the
// Python backend's data_access/kv.py exactly, so both apps share one contract.

/** Read one config blob by key, or `def` when the key is absent. */
export async function kvGet<T>(sql: Sql, key: string, def: T): Promise<T> {
  const rows = (await sql`SELECT value FROM app_config WHERE key = ${key}`) as {
    value: T;
  }[];
  return rows.length ? rows[0].value : def;
}

/** Upsert a JSON-serializable blob under `key`. */
export async function kvSet(sql: Sql, key: string, value: unknown): Promise<void> {
  await sql`
    INSERT INTO app_config (key, value, updated_at)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()`;
}

/** All keys beginning with `prefix` (used for `archive:YYYY-MM`). */
export async function kvKeysWithPrefix(sql: Sql, prefix: string): Promise<string[]> {
  const rows = (await sql`SELECT key FROM app_config WHERE key LIKE ${
    prefix + "%"
  }`) as { key: string }[];
  return rows.map((r) => r.key);
}
