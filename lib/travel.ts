import type { Sql } from "./db";
import { kvGet } from "./kv";

// Trips and their expenses, stored as one blob under `travel_data`. Expenses sit
// in a flat list keyed by `trip_id` so an edit touches one row, not a nested
// array. Every write re-reads the blob and merges a single trip or expense into
// it, so the client never sends (and can never clobber) the whole document.
//
// The merge is compare-and-swap on `updated_at`: if anything else wrote the blob
// between our read and our write (another tab, the phone), the write matches no
// row and the whole edit is replayed on the fresh copy. Nothing is overwritten
// blind.

type Dict = Record<string, any>;

export interface TravelData {
  trips: Dict[];
  expenses: Dict[];
}

export const TRAVEL_KEY = "travel_data";
export const TRAVEL_CATEGORIES = [
  "Flights", "Accommodation", "Food & Drink", "Transport", "Activities", "Shopping", "Other",
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const nowIso = () => new Date().toISOString();
const newId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
/** Field limits, mirrored as `maxLength` on the inputs (src/lib/travel.ts) so nothing is cut off unseen. */
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 200;

const str = (v: unknown, max = MAX_DESCRIPTION) => String(v ?? "").trim().slice(0, max);
const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : "");

const normalize = (data: Partial<TravelData> | null | undefined): TravelData => ({
  trips: data?.trips ?? [],
  expenses: data?.expenses ?? [],
});

export async function loadTravel(sql: Sql): Promise<TravelData> {
  return normalize(await kvGet<Partial<TravelData> | null>(sql, TRAVEL_KEY, null));
}

const MAX_ATTEMPTS = 10;

/** Thrown when every attempt lost the race; the worker turns it into a 409. */
export class TravelConflictError extends Error {}
/** Thrown when a bank transaction is already linked to a different trip (409). */
export class TravelLinkError extends Error {}
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Read the blob, apply `edit`, and write it back only if nobody wrote in between. */
async function mutateTravel(sql: Sql, edit: (data: TravelData) => void): Promise<TravelData> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Back off with jitter after a lost race so competing writers spread out.
    if (attempt > 0) await pause(Math.random() * 40 * attempt);
    const rows = (await sql`
      SELECT value, updated_at::text AS version FROM app_config WHERE key = ${TRAVEL_KEY}`) as {
      value: Partial<TravelData>;
      version: string;
    }[];
    const data = normalize(rows[0]?.value);
    edit(data);
    const json = JSON.stringify(data);
    const written = rows.length
      ? await sql`
          UPDATE app_config SET value = ${json}::jsonb, updated_at = now()
          WHERE key = ${TRAVEL_KEY} AND updated_at::text = ${rows[0].version}
          RETURNING key`
      : await sql`
          INSERT INTO app_config (key, value, updated_at)
          VALUES (${TRAVEL_KEY}, ${json}::jsonb, now())
          ON CONFLICT (key) DO NOTHING
          RETURNING key`;
    if ((written as unknown[]).length) return data;
  }
  throw new TravelConflictError("Travel data is being changed elsewhere — try again");
}

export const MAX_SPLIT = 20;
export const MAX_CURRENCIES = 4;

/** A trip's local currencies (never GBP, which is always available), first = main one. */
export function tripCurrencies(trip: Dict): { code: string; rate: number }[] {
  if (Array.isArray(trip.currencies)) return trip.currencies;
  // Trips saved before multi-currency carry a single currency + rate.
  return trip.currency && trip.currency !== "GBP" ? [{ code: trip.currency, rate: trip.rate }] : [];
}

/**
 * Local currencies from a trip save: `currencies` when sent, else the single
 * `currency` + `rate` older clients send. Codes are upper-cased 3-letter codes,
 * GBP and duplicates dropped, rates must be positive, at most MAX_CURRENCIES.
 */
function cleanCurrencies(input: Dict): { code: string; rate: number }[] {
  const raw: Dict[] = Array.isArray(input.currencies)
    ? input.currencies
    : [{ code: input.currency, rate: input.rate }];
  const out: { code: string; rate: number }[] = [];
  for (const c of raw) {
    const code = str(c?.code, 3).toUpperCase();
    const rate = num(c?.rate);
    if (!/^[A-Z]{3}$/.test(code) || code === "GBP" || rate <= 0 || out.some((x) => x.code === code)) continue;
    out.push({ code, rate });
  }
  return out.slice(0, MAX_CURRENCIES);
}

/** People an expense is split between: a whole number from 1 (not split) to MAX_SPLIT. */
const splitOf = (v: unknown) => Math.min(MAX_SPLIT, Math.max(1, Math.round(num(v) || 1)));

/**
 * A trip's spending plan: per category, an estimate in pounds, either per day
 * or for the whole trip. Unknown categories and non-positive amounts are dropped.
 */
function cleanPlan(v: unknown): Dict {
  const out: Dict = {};
  if (!v || typeof v !== "object") return out;
  for (const [category, line] of Object.entries(v as Dict)) {
    const amount = Math.max(0, num(line?.amount));
    if (TRAVEL_CATEGORIES.includes(category) && amount > 0) {
      out[category] = { amount, per_day: Boolean(line?.per_day) };
    }
  }
  return out;
}

/**
 * Insert or update a trip. An unknown `id` is kept, so an undone delete comes
 * back as it was. `plan` is only touched when sent (the trip dialog doesn't), so
 * editing a trip's details never wipes its plan.
 */
export async function upsertTrip(sql: Sql, input: Dict): Promise<TravelData> {
  const asked = cleanCurrencies(input);
  const fields = {
    name: str(input.name, MAX_NAME) || "Untitled trip",
    destination: str(input.destination, MAX_NAME),
    start_date: date(input.start_date),
    end_date: date(input.end_date),
    budget: Math.max(0, num(input.budget)),
    ...(input.plan !== undefined ? { plan: cleanPlan(input.plan) } : {}),
    updated_at: nowIso(),
  };
  if (fields.start_date && fields.end_date && fields.end_date < fields.start_date) {
    [fields.start_date, fields.end_date] = [fields.end_date, fields.start_date];
  }
  const id = str(input.id, 40) || newId();
  return mutateTravel(sql, (data) => {
    const i = data.trips.findIndex((t) => t.id === id);
    const existing = i >= 0 ? data.trips[i] : null;
    const currencies = [...asked];
    if (existing) {
      const had = tripCurrencies(existing);
      for (const e of data.expenses) {
        if (e.trip_id !== id) continue;
        // Older expenses carry no currency: they meant pounds (in_gbp) or the
        // trip's main currency at the time. Pin that now, so reordering or
        // changing the main currency can't quietly change what they meant.
        if (!e.currency) {
          e.currency = e.in_gbp || !had[0] ? "GBP" : had[0].code;
          e.in_gbp = e.currency === "GBP";
        }
        // A currency this trip's expenses are recorded in can't be dropped —
        // they'd have nothing to convert at — so it's kept at its old rate.
        if (e.currency === "GBP" || currencies.some((c) => c.code === e.currency)) continue;
        const kept = had.find((c) => c.code === e.currency);
        if (kept) currencies.push(kept);
      }
    }
    const withCurrencies = {
      ...fields,
      currencies,
      // The first currency, mirrored for anything that reads a single one.
      currency: currencies[0]?.code ?? "GBP",
      rate: currencies[0]?.rate ?? 1,
    };
    if (existing) data.trips[i] = { ...existing, ...withCurrencies };
    else data.trips.push({ id, created_at: input.created_at ?? nowIso(), ...withCurrencies });
  });
}

/**
 * Set or clear one category of a trip's plan. One line per write, merged on the
 * fresh copy, so edits to different rows can't overwrite each other.
 */
export async function setTripPlanLine(sql: Sql, tripId: string, input: Dict): Promise<TravelData> {
  const category = String(input.category ?? "");
  if (!TRAVEL_CATEGORIES.includes(category)) throw new Error(`Unknown category: ${category}`);
  const line = cleanPlan({ [category]: input })[category];
  return mutateTravel(sql, (data) => {
    const trip = data.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error(`Unknown trip: ${tripId}`);
    const plan = { ...(trip.plan ?? {}) };
    if (line) plan[category] = line;
    else delete plan[category];
    trip.plan = plan;
    trip.updated_at = nowIso();
  });
}

/** Remove a trip together with every expense recorded against it. */
export async function deleteTrip(sql: Sql, tripId: string): Promise<TravelData> {
  return mutateTravel(sql, (data) => {
    data.trips = data.trips.filter((t) => t.id !== tripId);
    data.expenses = data.expenses.filter((e) => e.trip_id !== tripId);
  });
}

function expenseFields(input: Dict) {
  return {
    id: str(input.id, 40) || newId(),
    created_at: input.created_at,
    fields: {
      trip_id: str(input.trip_id, 40),
      date: date(input.date),
      description: str(input.description),
      category: TRAVEL_CATEGORIES.includes(input.category) ? input.category : "Other",
      amount: Math.abs(num(input.amount)),
      in_gbp: Boolean(input.in_gbp),
      // Which currency the amount is in: GBP or one of the trip's. Replaces the
      // older in_gbp flag, which is kept in step for readers of it.
      ...(input.currency
        ? { currency: str(input.currency, 3).toUpperCase(), in_gbp: str(input.currency, 3).toUpperCase() === "GBP" }
        : {}),
      // Card or Flex, for expenses entered by hand (linked ones are known by
      // their tx_ref). Only set when sent.
      ...(input.paid_with === "card" || input.paid_with === "flex" ? { paid_with: input.paid_with } : {}),
      // How many people share it; totals count amount / split as your share.
      // Omitted by callers that don't know about splitting, so it's kept then.
      ...(input.split !== undefined ? { split: splitOf(input.split) } : {}),
      // The bank transaction this came from, as "<source>:<bank row id>" — the
      // bank's own id, which never changes (unlike the app's hashed flag_id).
      // Only ever set, never cleared by an edit that doesn't mention it, so
      // editing a linked expense keeps the link.
      ...(input.tx_ref ? { tx_ref: str(input.tx_ref, 120) } : {}),
      updated_at: nowIso(),
    },
  };
}

/**
 * Insert or update several expenses in one write — linking a batch of bank
 * transactions shouldn't be a dozen round trips.
 *
 * Normal mode is all or nothing: an expense for a missing trip, or a bank
 * transaction already linked to another trip, rejects the whole batch. A bank
 * transaction is one expense, found by `tx_ref`, whatever id the request used.
 *
 * `restore` mode is for Undo, which replays a snapshot taken before a delete.
 * It only puts back what is still absent — never overwriting an expense that
 * reappeared under that id, re-linking a transaction that has since been linked
 * elsewhere, or reviving one whose trip is gone — and skips the rest quietly.
 */
export async function upsertTripExpenses(
  sql: Sql,
  inputs: Dict[],
  { restore = false }: { restore?: boolean } = {},
): Promise<TravelData> {
  const rows = inputs.map(expenseFields);
  return mutateTravel(sql, (data) => {
    for (const { id, created_at, fields } of rows) {
      // Checked against the fresh copy on every attempt, so a trip deleted
      // elsewhere mid-write can't be left with an orphaned expense.
      if (!data.trips.some((t) => t.id === fields.trip_id)) {
        if (restore) continue;
        throw new Error(`Unknown trip: ${fields.trip_id}`);
      }
      const ref = "tx_ref" in fields ? fields.tx_ref : undefined;
      const byRef = ref ? data.expenses.findIndex((e) => e.tx_ref === ref) : -1;
      const byId = data.expenses.findIndex((e) => e.id === id);

      if (restore) {
        if (byId >= 0 || byRef >= 0) continue;
        data.expenses.push({ id, created_at: created_at ?? nowIso(), ...fields });
        continue;
      }

      if (byRef >= 0 && data.expenses[byRef].id !== id) {
        const owner = data.expenses[byRef];
        if (owner.trip_id !== fields.trip_id) {
          const name = data.trips.find((t) => t.id === owner.trip_id)?.name ?? "another trip";
          throw new TravelLinkError(`That transaction is already linked to ${name}`);
        }
        // Linked again to the same trip: update the existing expense, keep its id.
        data.expenses[byRef] = { ...owner, ...fields };
        continue;
      }
      if (byId >= 0) data.expenses[byId] = { ...data.expenses[byId], ...fields };
      else data.expenses.push({ id, created_at: created_at ?? nowIso(), ...fields });
    }
  });
}

/** Insert or update one expense. Refuses an expense for a trip that doesn't exist. */
export const upsertTripExpense = (sql: Sql, input: Dict) => upsertTripExpenses(sql, [input]);

export async function deleteTripExpense(sql: Sql, expenseId: string): Promise<TravelData> {
  return mutateTravel(sql, (data) => {
    data.expenses = data.expenses.filter((e) => e.id !== expenseId);
  });
}
