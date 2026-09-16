import { TRAVEL_CATEGORIES, type PaidWith, type TravelCategory, type Trip, type TripCurrency, type TripExpense } from "../types/travel";
import { RENT_UTILITY_CATEGORY } from "../types/categories";

/** Categories paid up front rather than day to day — left out of the per-day figure. */
export const PREPAID: TravelCategory[] = ["Flights", "Accommodation"];

export const CATEGORY_COLORS: Record<TravelCategory, string> = {
  Flights: "#6366f1",
  Accommodation: "#8b5cf6",
  "Food & Drink": "#f59e0b",
  Transport: "#0ea5e9",
  Activities: "#10b981",
  Shopping: "#ec4899",
  Other: "#9ca3af",
};

/**
 * Ids are minted in the browser, not on the server, so a new trip can be selected
 * the moment it's submitted and a double-submitted save lands on the same row
 * instead of creating a duplicate.
 */
export const newTravelId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);

/** Server-side field limits (lib/travel.ts), applied as `maxLength` on the inputs. */
export const MAX_NAME = 80;
export const MAX_DESCRIPTION = 200;

const DAY_MS = 86_400_000;
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export const todayIso = (now = new Date()) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

type CurrencyTrip = Pick<Trip, "currency" | "rate" | "currencies">;
type MoneyExpense = Pick<TripExpense, "amount" | "in_gbp" | "currency">;

export const MAX_CURRENCIES = 4;

/** A trip's local currencies, main first. Trips saved before multi-currency carry just one. */
export function tripCurrencies(trip: CurrencyTrip): TripCurrency[] {
  if (trip.currencies) return trip.currencies;
  return trip.currency && trip.currency !== "GBP" ? [{ code: trip.currency, rate: trip.rate }] : [];
}

/** The currency an expense was entered in. Older expenses only say whether it was pounds. */
export function expenseCurrency(e: Pick<TripExpense, "in_gbp" | "currency">, trip: CurrencyTrip): string {
  if (e.currency) return e.currency;
  const main = tripCurrencies(trip)[0];
  return e.in_gbp || !main ? "GBP" : main.code;
}

/** Units of `code` per £1 on this trip (1 for pounds). */
export function rateFor(trip: CurrencyTrip, code: string): number {
  if (code === "GBP") return 1;
  return tripCurrencies(trip).find((c) => c.code === code)?.rate || 1;
}

/** An expense's full value in pounds — what was paid, before any split. */
export const toGbp = (e: MoneyExpense, trip: CurrencyTrip) => e.amount / rateFor(trip, expenseCurrency(e, trip));

/** A pound value shown in `code` at the trip's rate, whole units: "€42", "CHF 40", "£36". */
export const displayMoney = (gbp: number, trip: CurrencyTrip, code: string) =>
  localMoney(gbp * rateFor(trip, code), code);

export const MAX_SPLIT = 20;
export const splitOf = (e: Pick<TripExpense, "split">) => Math.max(1, e.split ?? 1);

/** Your share in pounds: the full value divided by how many split it. All totals use this. */
export const shareGbp = (e: MoneyExpense & Pick<TripExpense, "split">, trip: CurrencyTrip) =>
  toGbp(e, trip) / splitOf(e);

/** Inclusive length of the trip in days; 0 when the dates aren't set. */
export function tripDays(trip: Pick<Trip, "start_date" | "end_date">): number {
  if (!trip.start_date || !trip.end_date) return 0;
  return Math.round((utc(trip.end_date) - utc(trip.start_date)) / DAY_MS) + 1;
}

export type TripStatus = "upcoming" | "ongoing" | "past" | "undated";

export function tripStatus(trip: Pick<Trip, "start_date" | "end_date">, today = todayIso()): TripStatus {
  if (!trip.start_date || !trip.end_date) return "undated";
  if (today < trip.start_date) return "upcoming";
  if (today > trip.end_date) return "past";
  return "ongoing";
}

/** Days of the trip that have happened (all of them once it's over, none before it starts). */
export function daysElapsed(trip: Pick<Trip, "start_date" | "end_date">, today = todayIso()): number {
  const status = tripStatus(trip, today);
  if (status === "ongoing") return Math.round((utc(today) - utc(trip.start_date)) / DAY_MS) + 1;
  return status === "past" ? tripDays(trip) : 0;
}

/** Which trip to open by default: the one you're on, else the next one, else the latest. */
export function defaultTrip(trips: Trip[], today = todayIso()): Trip | undefined {
  const ongoing = trips.find((t) => tripStatus(t, today) === "ongoing");
  if (ongoing) return ongoing;
  const upcoming = trips
    .filter((t) => tripStatus(t, today) === "upcoming")
    .sort((a, b) => a.start_date.localeCompare(b.start_date))[0];
  return upcoming ?? sortTrips(trips)[0];
}

/** Newest first; undated trips go by creation time. */
export const sortTrips = (trips: Trip[]) =>
  [...trips].sort((a, b) =>
    (b.start_date || b.created_at).localeCompare(a.start_date || a.created_at),
  );

/** Flex if linked from a Flex purchase or marked Flex by hand; card otherwise. */
export const paidWith = (e: Pick<TripExpense, "tx_ref" | "paid_with">): PaidWith =>
  e.tx_ref?.startsWith("flex:") ? "flex" : e.paid_with ?? "card";

export interface TripSummary {
  /** Your share, by how it was paid: now by card, or later via Flex. */
  byPayment: Record<PaidWith, number>;
  /** Your share of everything. */
  total: number;
  /** What others owe back on split expenses (full paid minus your share). */
  owed: number;
  prepaid: number;
  /** Everything outside PREPAID — the spend that scales with days. */
  dayToDay: number;
  /** Day-to-day spend per day of the trip so far (or per planned day before it starts). */
  perDay: number;
  byCategory: { category: TravelCategory; total: number }[];
}

export function summarize(trip: Trip, expenses: TripExpense[], today = todayIso()): TripSummary {
  const cats = new Map<TravelCategory, number>();
  let total = 0;
  let prepaid = 0;
  let owed = 0;
  const byPayment: Record<PaidWith, number> = { card: 0, flex: 0 };
  for (const e of expenses) {
    const gbp = shareGbp(e, trip);
    byPayment[paidWith(e)] += gbp;
    total += gbp;
    owed += toGbp(e, trip) - gbp;
    if (PREPAID.includes(e.category)) prepaid += gbp;
    cats.set(e.category, (cats.get(e.category) ?? 0) + gbp);
  }
  const dayToDay = total - prepaid;
  const n = tripDays(trip);
  const divisor = daysElapsed(trip, today) || n;

  return {
    byPayment,
    total,
    owed,
    prepaid,
    dayToDay,
    perDay: divisor ? dayToDay / divisor : 0,
    byCategory: TRAVEL_CATEGORIES.filter((c) => cats.get(c)).map((category) => ({
      category,
      total: cats.get(category)!,
    })).sort((a, b) => b.total - a.total),
  };
}

/** The repayment rows `flexSchedule` reads (a subset of Repayments' shape). */
export interface FlexRepaymentRow {
  flex_id: string;
  amount: number;
  repayment_1_date: string | null;
  repayment_1_amount: number | null;
  repayment_2_date: string | null;
  repayment_2_amount: number | null;
  repayment_3_date: string | null;
  repayment_3_amount: number | null;
}

/**
 * When the trip's Flex spend gets repaid: your share of each linked purchase's
 * repayments, summed by month (YYYY-MM), oldest first. A split purchase repays
 * in full but only your share counts. Flex expenses with no schedule to read —
 * entered by hand, or no longer in Repayments — add to `unscheduled`.
 */
export function flexSchedule(
  trip: Trip,
  expenses: TripExpense[],
  repayments: FlexRepaymentRow[],
): { months: { month: string; amount: number }[]; unscheduled: number } {
  const byId = new Map(repayments.map((r) => [r.flex_id, r]));
  const months = new Map<string, number>();
  let unscheduled = 0;
  for (const e of expenses) {
    if (paidWith(e) !== "flex") continue;
    const share = shareGbp(e, trip);
    const row = e.tx_ref?.startsWith("flex:") ? byId.get(e.tx_ref.slice(5)) : undefined;
    const parts = row
      ? ([1, 2, 3] as const)
          .map((i) => ({ date: row[`repayment_${i}_date`], amount: Math.abs(row[`repayment_${i}_amount`] ?? 0) }))
          .filter((p) => p.date && p.amount > 0)
      : [];
    const scheduled = parts.reduce((s, p) => s + p.amount, 0);
    if (!row || !scheduled) {
      unscheduled += share;
      continue;
    }
    // Scale the full repayments down to your share (a split, or a purchase
    // amount that differs from the schedule total).
    const ratio = share / scheduled;
    for (const p of parts) {
      const month = p.date!.slice(0, 7);
      months.set(month, (months.get(month) ?? 0) + p.amount * ratio);
    }
  }
  return {
    months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
    unscheduled,
  };
}

/** Categories that are usually estimated per day rather than once for the trip. */
export const PER_DAY_BY_DEFAULT: TravelCategory[] = ["Food & Drink", "Transport", "Activities", "Other"];

export interface PlanRow {
  category: TravelCategory;
  amount: number;
  per_day: boolean;
  /** amount × trip days when per day, else amount. */
  planned: number;
  spent: number;
}

/**
 * Plan vs actual for every category, plus totals. `expected` is what the trip
 * should come to: per category, the larger of plan and spend — so spend in a
 * category with no plan (flights already booked) adds to the plan elsewhere,
 * while spend inside a planned category isn't counted twice.
 */
export function planRows(
  trip: Trip,
  summary: TripSummary,
): { rows: PlanRow[]; planned: number; spent: number; expected: number } {
  const days = tripDays(trip);
  const rows = TRAVEL_CATEGORIES.map((category) => {
    const line = trip.plan?.[category];
    const per_day = line ? line.per_day : PER_DAY_BY_DEFAULT.includes(category);
    const amount = line?.amount ?? 0;
    return {
      category,
      amount,
      per_day,
      planned: per_day ? amount * days : amount,
      spent: summary.byCategory.find((c) => c.category === category)?.total ?? 0,
    };
  });
  return {
    rows,
    planned: rows.reduce((s, r) => s + r.planned, 0),
    spent: summary.total,
    expected: rows.reduce((s, r) => s + Math.max(r.planned, r.spent), 0),
  };
}

/** "3 Oct – 9 Oct 2026", collapsing the repeated year. */
export function formatTripDates(trip: Pick<Trip, "start_date" | "end_date">): string {
  if (!trip.start_date) return "No dates yet";
  const fmt = (d: string, year: boolean) =>
    new Date(utc(d)).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      timeZone: "UTC",
    });
  if (!trip.end_date || trip.end_date === trip.start_date) return fmt(trip.start_date, true);
  const sameYear = trip.start_date.slice(0, 4) === trip.end_date.slice(0, 4);
  return `${fmt(trip.start_date, !sameYear)} – ${fmt(trip.end_date, true)}`;
}

/** "Mon 3 Oct" for expense rows. */
export const formatExpenseDate = (d: string) =>
  d
    ? new Date(utc(d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
    : "—";

/** Whole units with the currency code, e.g. "€42" or "1,200 AZN". */
export function localMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("en-GB")} ${currency}`;
  }
}

// ── Linking bank transactions ────────────────────────────────────────────────

/** How far either side of the trip to look for card spend (flights are booked early). */
export const LINK_DAYS_BEFORE = 90;
export const LINK_DAYS_AFTER = 7;

const shiftDays = (d: string, n: number) => iso(utc(d) + n * DAY_MS);

/** The date window searched for linkable transactions, or null for an undated trip. */
export function linkWindow(trip: Pick<Trip, "start_date" | "end_date">): { from: string; to: string } | null {
  if (!trip.start_date) return null;
  return {
    from: shiftDays(trip.start_date, -LINK_DAYS_BEFORE),
    to: shiftDays(trip.end_date || trip.start_date, LINK_DAYS_AFTER),
  };
}

/** Every YYYY-MM from `from`'s month to `to`'s, inclusive. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = +from.slice(0, 4);
  let m = +from.slice(5, 7);
  const end = to.slice(0, 7);
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (key > end) break;
    out.push(key);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const CATEGORY_HINTS: [TravelCategory, RegExp][] = [
  ["Flights", /AIRWAYS|AIRLINE|EASYJET|RYANAIR|WIZZ|LUFTHANSA|VUELING|JET2|KLM|AIR FRANCE|EMIRATES|TURKISH AIR|AZAL|FLYDUBAI|SKYSCANNER|\bTAP\b|PEGASUS/i],
  ["Accommodation", /AIRBNB|BOOKING\.COM|HOTEL|HOSTEL|EXPEDIA|MARRIOTT|HILTON|IBIS|PREMIER INN|HOLIDAY INN|VRBO|AGODA/i],
  ["Transport", /UBER|BOLT|TRAINLINE|EUROSTAR|RAIL|TAXI|FREENOW|HEATHROW EXPRESS|GATWICK EXPRESS|STANSTED EXPRESS|NATIONAL EXPRESS|FLIXBUS|HERTZ|SIXT|EUROPCAR|PARKING/i],
  ["Activities", /MUSEUM|TICKET|GETYOURGUIDE|VIATOR|KLOOK|TOUR|GALLERY|SPA\b/i],
  ["Food & Drink", /RESTAURANT|CAFE|COFFEE|\bBAR\b|PUB|BAKERY|PIZZ|SUSHI|BURGER|MCDONALD|STARBUCKS|PRET\b/i],
];

const SUBCATEGORY_TO_TRAVEL: Record<string, TravelCategory> = {
  Groceries: "Food & Drink",
  Lunch: "Food & Drink",
  "Going Out": "Food & Drink",
  Coffee: "Food & Drink",
  Shopping: "Shopping",
  Transport: "Transport",
};

/** Best-guess travel category for a bank transaction; editable after linking. */
export function guessTravelCategory(tx: { description: string; merchant_name: string | null; subcategory: string }): TravelCategory {
  const text = `${tx.merchant_name ?? ""} ${tx.description ?? ""}`;
  for (const [category, re] of CATEGORY_HINTS) if (re.test(text)) return category;
  return SUBCATEGORY_TO_TRAVEL[tx.subcategory] ?? "Other";
}

/**
 * A bank transaction's permanent identity: its source plus the bank's own row
 * id. Not `flag_id`, which is recomputed each load and can shift when identical
 * same-day rows appear.
 */
export const txRef = (tx: { source: string; id: string }) => `${tx.source}:${tx.id}`;

/** The shape linkCandidates reads — a bank transaction, or a Flex purchase mapped to it. */
export interface LinkableTransaction {
  id: string;
  source: string;
  created: string;
  description: string;
  merchant_name: string | null;
  amount: number;
  category: string;
  subcategory: string;
}

/**
 * A Flex purchase (from Repayments) as a linkable transaction. Flex purchases
 * never reach the Transactions list — only their monthly repayments do — so the
 * purchase itself has to come from here. Refunded ones are left out.
 */
export function flexAsTransaction(r: {
  flex_id: string;
  created: string;
  description: string;
  amount: number;
  refunded: boolean;
  /** The category given to it under Repayments, e.g. "Travel". */
  category?: string;
}): LinkableTransaction | null {
  if (r.refunded) return null;
  return {
    id: r.flex_id,
    source: "flex",
    created: r.created,
    description: r.description,
    merchant_name: null,
    amount: r.amount,
    category: r.category ?? "",
    subcategory: "Flex",
  };
}

export interface LinkCandidate {
  ref: string;
  /** "flex" for Monzo Flex purchases; a bank source otherwise. */
  source: string;
  date: string;
  description: string;
  subcategory: string;
  amount: number; // pounds, positive
  guess: TravelCategory;
  /**
   * Why it's suggested (nothing is pre-ticked): categorised as Travel or looks
   * like a flight / stay by merchant, or spent during the trip.
   */
  reason: "travel" | "during" | null;
  /** The trip it's already linked to, if any — one transaction belongs to one trip. */
  linkedTripId: string | null;
}

/**
 * Card spend in the trip's window, suggestions first, newest first within each
 * group. `allExpenses` spans every trip, so a transaction already linked to
 * another trip shows as taken rather than being moved over silently.
 */
export function linkCandidates(
  trip: Trip,
  transactions: LinkableTransaction[],
  allExpenses: TripExpense[],
): LinkCandidate[] {
  const window = linkWindow(trip);
  if (!window) return [];
  const linked = new Map<string, string>();
  for (const e of allExpenses) if (e.tx_ref) linked.set(e.tx_ref, e.trip_id);
  const end = trip.end_date || trip.start_date;
  const seen = new Set<string>();
  const out: LinkCandidate[] = [];
  for (const tx of transactions) {
    const date = (tx.created ?? "").slice(0, 10);
    const ref = txRef(tx);
    if (tx.amount >= 0 || date < window.from || date > window.to || seen.has(ref)) continue;
    seen.add(ref);
    // Rent and bills go out whether you're away or not, so they're never a
    // "during the trip" suggestion — still linkable from Everything.
    const during = date >= trip.start_date && date <= end && tx.category !== RENT_UTILITY_CATEGORY;
    const guess = guessTravelCategory(tx);
    const looksLikeTravel = tx.category === "Travel" || guess === "Flights" || guess === "Accommodation";
    const reason = looksLikeTravel ? "travel" : during ? "during" : null;
    out.push({
      ref,
      source: tx.source,
      date,
      // Card descriptions pad the merchant, city and country with runs of spaces.
      description: (tx.merchant_name || tx.description || "").replace(/\s+/g, " ").trim(),
      subcategory: tx.subcategory,
      amount: -tx.amount,
      guess,
      reason,
      linkedTripId: linked.get(ref) ?? null,
    });
  }
  return out.sort((a, b) => Number(!!b.reason) - Number(!!a.reason) || b.date.localeCompare(a.date));
}
