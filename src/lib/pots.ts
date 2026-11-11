import type { RentData, RentItemDef, RentPotSettlement } from "../types/rent";
import { rentCell, rentIsPaid, rentShare } from "./rent";
import { addMonths } from "./savingsGoal";

/**
 * Bills pots: the money set aside each month for the quarterly bills (the
 * `saved` rent items). It lives in the savings account, but it is earmarked.
 *
 * Money enters a pot when a month's allocation is actually moved across — i.e.
 * the row is ticked or matched, not merely budgeted. Money leaves when a bill
 * is paid from it, in one of two ways:
 *
 *   settled — the balance that had accrued pays the bill, any surplus goes
 *     back to savings, any shortfall comes out of it, and the pot restarts
 *     from zero;
 *   paid in part — only the bill leaves and the rest stays in the pot.
 *
 * Each entry records what it moved to or from savings at the time (`diff`), so
 * a pot is a plain ledger: balance = money in − bills paid − moved to savings.
 * Editing a month from before an entry therefore changes today's balance, not
 * that entry's result — a settled pot with a corrected earlier month reopens
 * showing the difference, rather than quietly rewriting what was settled.
 */

/**
 * Whether a month's money is headed for the pot rather than out to the biller.
 * The month's own answer wins; with none, the item's default decides.
 */
export function goesToPot(data: RentData, key: string, month: string): boolean {
  const stated = rentCell(data, month, key).to_pot;
  if (stated != null) return stated;
  const item = data.items?.find((i) => i.key === key);
  return item?.pot_default ?? item?.saved ?? false;
}

/**
 * What actually reached the pot for one month — 0 until the money moves, only
 * for months routed to the pot, and only your share of it: a pot holds your
 * money, so a bill someone else part-covers accrues at the net figure.
 */
export function potInflow(data: RentData, key: string, month: string): number {
  return rentIsPaid(data, month, key) && goesToPot(data, key, month)
    ? rentShare(data, month, key)
    : 0;
}

export interface PotSettlementView extends RentPotSettlement {
  /** Where this entry sits in the stored list — what Undo removes. */
  index: number;
  /** Balance the pot held just before this bill was paid from it. */
  accrued: number;
  /**
   * What this did to savings: positive went back to it, negative came out of
   * it. A settlement releases accrued − bill; a part-payment never releases
   * anything, so it is only ever the shortfall. Frozen when recorded.
   */
  diff: number;
  /**
   * Left in the pot afterwards — 0 once settled, unless an earlier month has
   * been edited since, in which case it carries that correction.
   */
  remaining: number;
}

export interface PotView {
  key: string;
  label: string;
  /** What the pot holds after everything up to and including `upTo`. */
  balance: number;
  /** Settlements and part-payments alike, oldest first. */
  settlements: PotSettlementView[];
  /** Month of the last full settlement — part-payments leave the pot open. */
  lastSettled?: string;
  /** Settled, and nothing has gone in since — safe to retire from the table. */
  closed: boolean;
}

/** Rounded to the penny; `|| 0` folds the -0 a tiny negative rounds to. */
const cents = (n: number) => Math.round(n * 100) / 100 || 0;

/**
 * What paying `bill` from a pot holding `balance` moves to (+) or from (−)
 * savings. Settled, everything left goes back and a shortfall comes out; paid
 * in part, nothing goes back — only a shortfall comes out.
 */
const entryDiff = (balance: number, bill: number, partial: boolean) =>
  cents(partial ? Math.min(0, balance - bill) : balance - bill);

/** Walks one item's months and pot entries up to `upTo` into its ledger. */
function ledger(data: RentData, it: RentItemDef, months: string[], upTo: string): PotView {
  // The stored position travels with each entry so Undo can find it again.
  // The sort is stable, so entries in the same month keep the order they
  // were recorded in.
  const settlements = (data.pots?.[it.key]?.settlements ?? [])
    .map((s, index) => ({ ...s, index }))
    .sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));

  // Walk the months once, paying each bill out of the running total.
  let running = 0;
  let si = 0;
  const view: PotSettlementView[] = [];
  const pay = (s: RentPotSettlement & { index: number }) => {
    // The frozen figure wins; older entries are worked out as of now.
    const diff = s.diff ?? entryDiff(running, s.bill, !!s.partial);
    const remaining = cents(running - s.bill - diff);
    view.push({ ...s, accrued: running, diff, remaining });
    running = remaining;
  };
  for (const m of months) {
    if (m > upTo) break;
    running += potInflow(data, it.key, m);
    while (si < settlements.length && settlements[si].month <= m) pay(settlements[si++]);
  }
  // Bills dated beyond the months we hold still come out of the pot.
  while (si < settlements.length && settlements[si].month <= upTo) pay(settlements[si++]);

  const last = view[view.length - 1];
  const lastSettled = view.filter((s) => !s.partial).pop()?.month;
  return {
    key: it.key,
    label: it.label,
    balance: running,
    settlements: view,
    lastSettled,
    closed: last != null && !last.partial && running === 0,
  };
}

const sortedMonths = (data: RentData) => Object.keys(data.months ?? {}).sort();

/**
 * One view per saved item. `upTo` bounds the balance to months that have
 * actually happened, so future allocations don't inflate it.
 */
export function potViews(data: RentData, upTo: string): PotView[] {
  const months = sortedMonths(data);
  return (data.items ?? []).filter((it) => it.saved).map((it) => ledger(data, it, months, upTo));
}

/** Total sitting in pots right now — the honest "set aside" figure. */
export const potsTotal = (views: PotView[]) => views.reduce((sum, p) => sum + p.balance, 0);

/** One pot's view as of `month`, or undefined if `key` has no pot. */
export const potAt = (data: RentData, key: string, month: string) =>
  potViews(data, month).find((p) => p.key === key);

/**
 * A new entry paying `bill` from the pot in `month`, with what it moves to or
 * from savings worked out — and frozen — from the balance it meets there.
 */
export function potEntry(
  data: RentData,
  key: string,
  month: string,
  bill: number,
  partial: boolean,
): RentPotSettlement {
  const balance = potAt(data, key, month)?.balance ?? 0;
  return { month, bill, diff: entryDiff(balance, bill, partial), ...(partial && { partial: true }) };
}

/**
 * The pot's stored entries with every result frozen, for writing back. Entries
 * made before results were stored get the figure they read as today, so the
 * first save after this lands pins history where it already stands.
 */
export function frozenEntries(data: RentData, key: string, upTo: string): RentPotSettlement[] {
  const live = new Map((potAt(data, key, upTo)?.settlements ?? []).map((s) => [s.index, s.diff]));
  return (data.pots?.[key]?.settlements ?? []).map((s, i) =>
    s.diff != null || !live.has(i) ? s : { ...s, diff: live.get(i) },
  );
}

/**
 * Months a payment can be dated in, newest first: from the pot's latest entry
 * (or, with none, the first month money went in) up to `upTo`, at most `max`.
 *
 * Never before the latest entry. Each entry froze its result against the
 * balance it met, so slipping a payment in ahead of one would leave that later
 * result counting money that had already gone — the pot would go negative with
 * nothing edited. A bill that genuinely landed earlier still fits: it's the
 * months since the last thing recorded that are open.
 */
export function payableMonths(data: RentData, key: string, upTo: string, max = 12): string[] {
  const entries = potAt(data, key, upTo)?.settlements ?? [];
  const latest = entries[entries.length - 1]?.month;
  const firstIn = sortedMonths(data).find((m) => potInflow(data, key, m) > 0);
  const start = latest ?? firstIn ?? upTo;
  const from = start < upTo ? start : upTo;
  const out: string[] = [];
  for (let m = upTo; m >= from && out.length < max; m = addMonths(m, -1)) out.push(m);
  return out;
}

/**
 * This month's set-aside for the pot that hasn't been ticked yet — worth
 * ticking before paying, since a payment freezes against the balance it sees.
 */
export function potPending(data: RentData, key: string, month: string): number {
  if (!goesToPot(data, key, month) || rentIsPaid(data, month, key)) return 0;
  return rentShare(data, month, key);
}

/**
 * How bills paid from pots in `month` change what bills cost.
 *
 * Set-asides count as spent the month they go in. For a pot of its own (Hot
 * Water) that is the whole story, so only what moved to or from savings
 * corrects it: a surplus sent back comes off, a shortfall goes on.
 *
 * A pot attached to a bill (Water) is different: the bill itself is already in
 * the table, on the month it was paid out. So the set-aside money the pot put
 * towards it (`bill + diff`) would be counted twice, and comes off too.
 */
export function potTrueUp(data: RentData, month: string): number {
  const attached = new Set((data.items ?? []).filter((it) => it.pot_default === false).map((it) => it.key));
  return cents(
    -settlementsIn(data, month).reduce((sum, s) => sum + s.diff + (attached.has(s.key) ? s.bill : 0), 0),
  );
}

/**
 * What a month's bills really cost you: your share of every item, trued up for
 * any pot paid from that month. Hot Water's set-asides read as spent each
 * month; the month its bill lands, whatever went back to savings comes off.
 */
export const rentMonthCost = (data: RentData, month: string) =>
  (data.items ?? []).reduce((sum, it) => sum + rentShare(data, month, it.key), 0) +
  potTrueUp(data, month);

/**
 * Bills paid from a pot in `month`, as Diff-in-bills rows: what the pot put
 * towards the bill (`bill + diff`) is what was allocated, the bill is what was
 * paid. Settled, that is the whole balance; paid in part, only up to the bill,
 * so a part-payment the pot covers nets to nothing.
 *
 * Includes items whose pot has since been removed: what they paid out still
 * happened, and still counts.
 */
export function settlementsIn(data: RentData, month: string) {
  const months = sortedMonths(data);
  return (data.items ?? [])
    .filter((it) => it.saved || data.pots?.[it.key]?.settlements?.length)
    .flatMap((it) => {
      const p = ledger(data, it, months, month);
      return p.settlements.map((s) => ({ ...s, key: p.key, label: p.label }));
    })
    .filter((s) => s.month === month);
}

/**
 * A saved item is retired for a month once its pot is settled and nothing more
 * has been put in — it stays visible for every month it was actually funding.
 */
export function isRetired(data: RentData, key: string, month: string, upTo: string): boolean {
  const view = potViews(data, upTo).find((p) => p.key === key);
  if (!view?.lastSettled || month <= view.lastSettled) return false;
  return potInflow(data, key, month) === 0 && (data.months?.[month]?.[key]?.amount ?? 0) === 0;
}
