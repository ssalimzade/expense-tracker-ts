import type { Sql } from "./db";

/**
 * Test-only stand-in for the Neon client. Nothing imports this from the Worker,
 * so it never reaches a bundle.
 *
 * `Sql` is used two ways in this codebase and the fake has to answer both: as a
 * tagged template (`kv.ts`) and as `.query(text, params)` (`transactions.ts`,
 * `synthetic.ts`). Rather than parse SQL, it matches the handful of shapes those
 * modules actually send and serves them from plain fixtures.
 */

type Row = Record<string, any>;

/** One bank row, as the fixtures describe it. */
export interface TxFixture {
  /** Which of the five transaction tables it lives in. */
  table: string;
  /** `created`, second-precision, the shape the columns are formatted back to. */
  created: string;
  description: string;
  amount: number;
  merchant_name?: string | null;
}

export interface FakeDb {
  /** `app_config` — key to stored blob. */
  config?: Record<string, unknown>;
  /** Bank rows across all tables; the fake buckets them by `table` itself. */
  transactions?: TxFixture[];
}

/**
 * Postgres computes these columns in the SELECT, so the fake has to as well —
 * fixtures carry a single `created` and the derived columns come from it, which
 * keeps a fixture honest about what the real query would return.
 */
function reconcileRow(t: TxFixture): Row {
  return {
    description: t.description,
    merchant_name: t.merchant_name ?? null,
    amount: t.amount,
    yr: Number(t.created.slice(0, 4)),
    mo: Number(t.created.slice(5, 7)),
    created_date: t.created.slice(0, 10),
    created_iso: t.created,
  };
}

export function fakeSql(db: FakeDb = {}): Sql {
  const config = db.config ?? {};
  const rows = db.transactions ?? [];

  // kv.ts talks to app_config through tagged templates.
  const tag = async (strings: TemplateStringsArray, ...values: any[]): Promise<Row[]> => {
    const text = strings.join(" ? ");
    if (/FROM app_config WHERE key =/.test(text)) {
      const key = values[0] as string;
      return key in config ? [{ value: config[key] }] : [];
    }
    throw new Error(`fakeSql: unhandled template query: ${text}`);
  };

  const query = async (text: string, params: any[] = []): Promise<Row[]> => {
    // reconcileRent: one windowed SELECT per transaction table.
    const reconcile = /FROM (\w+) WHERE created >= \$1 AND created < \$2/.exec(text);
    if (reconcile) {
      const [, table] = reconcile;
      const [from, until] = params as [string, string];
      return rows
        .filter((t) => t.table === table && t.created >= from && t.created < until)
        .map(reconcileRow);
    }
    throw new Error(`fakeSql: unhandled query: ${text}`);
  };

  return Object.assign(tag, { query }) as unknown as Sql;
}
