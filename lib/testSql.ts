import type { Sql } from "./db";

/**
 * Test-only stand-in for the Neon client. Nothing imports this from the Worker,
 * so it never reaches a bundle.
 *
 * `Sql` is used two ways in this codebase and the fake has to answer both: as a
 * tagged template (`kv.ts`) and as `.query(text, params)` (`transactions.ts`,
 * `synthetic.ts`). Rather than parse SQL, it recognises the handful of shapes
 * those modules actually send — by the columns each one selects — and serves
 * them from plain fixtures.
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
  /** The bank's own row id. Only matters where rows share description + created. */
  id?: string;
  currency?: string;
  status?: string;
  source?: string;
  /** Flex repayment splits. The first three are read back as r1/r2/r3. */
  repayments?: { date: string | null; amount: number | null }[];
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
const reconcileRow = (t: TxFixture): Row => ({
  description: t.description,
  merchant_name: t.merchant_name ?? null,
  amount: t.amount,
  yr: Number(t.created.slice(0, 4)),
  mo: Number(t.created.slice(5, 7)),
  created_date: t.created.slice(0, 10),
  created_iso: t.created,
});

const txRow = (t: TxFixture): Row => ({
  id: t.id,
  created_iso: t.created,
  description: t.description,
  amount: t.amount,
  currency: t.currency ?? "GBP",
  merchant_name: t.merchant_name ?? null,
  status: t.status ?? "booked",
  source: t.source ?? t.table.replace("_transactions", ""),
});

const flexRow = (t: TxFixture): Row => {
  const r = t.repayments ?? [];
  return {
    id: t.id,
    description: t.description,
    amount: t.amount,
    created_iso: t.created,
    r1d: r[0]?.date ?? null,
    r1a: r[0]?.amount ?? null,
    r2d: r[1]?.date ?? null,
    r2a: r[1]?.amount ?? null,
    r3d: r[2]?.date ?? null,
    r3a: r[2]?.amount ?? null,
  };
};

export function fakeSql(db: FakeDb = {}): Sql {
  const config = db.config ?? {};
  // A row without an explicit id still needs a distinct one, or the duplicate
  // ordering in `flagIdsFor` would have nothing to sort on.
  const rows: TxFixture[] = (db.transactions ?? []).map((t, i) => ({
    ...t,
    id: t.id ?? `row-${i}`,
  }));

  const from = (table: string) => rows.filter((t) => t.table === table);
  const tableIn = (text: string) => /FROM (\w+)/.exec(text)?.[1] ?? "";

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
    // reconcileRent — the only SELECT that pulls the year and month apart.
    if (/AS yr/.test(text)) {
      const [start, end] = params as [string, string];
      return from(tableIn(text))
        .filter((t) => t.created >= start && t.created < end)
        .map(reconcileRow);
    }

    // fetchFlexRows — the only one selecting the repayment split columns.
    if (/AS r1d/.test(text)) {
      return [...from("flex_transactions")]
        .sort((a, b) => (a.created < b.created ? 1 : a.created > b.created ? -1 : 0))
        .map(flexRow);
    }

    // fetchTxRows — whole table, or one month's window when given bounds.
    if (/AS created_iso/.test(text) && /currency/.test(text)) {
      let out = from(tableIn(text));
      if (params.length === 2) {
        const [start, end] = params as [string, string];
        out = out.filter((t) => t.created >= start && t.created < end);
      }
      return out.map(txRow);
    }

    throw new Error(`fakeSql: unhandled query: ${text}`);
  };

  return Object.assign(tag, { query }) as unknown as Sql;
}
