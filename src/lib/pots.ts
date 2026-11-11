import type { RentData, RentPotSettlement } from "../types/rent";
import { rentCell, rentIsPaid, rentShare } from "./rent";

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
 * Settlements therefore partition the timeline, and a pot's live balance is
 * whatever has accrued since the last one, less any part-payments since.
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
   * anything, so it is only ever the shortfall.
   */
  diff: number;
  /** Left in the pot afterwards — always 0 once settled. */
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
 * One view per saved item. `upTo` bounds the balance to months that have
 * actually happened, so future allocations don't inflate it.
 */
export function potViews(data: RentData, upTo: string): PotView[] {
  const months = Object.keys(data.months ?? {}).sort();

  return (data.items ?? [])
    .filter((it) => it.saved)
    .map((it) => {
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
        if (s.partial) {
          // Only the bill leaves; the rest stays earmarked in the pot.
          const remaining = cents(Math.max(0, running - s.bill));
          view.push({ ...s, accrued: running, diff: cents(Math.min(0, running - s.bill)), remaining });
          running = remaining;
        } else {
          // The bill is paid and whatever is left goes back to savings.
          view.push({ ...s, accrued: running, diff: cents(running - s.bill), remaining: 0 });
          running = 0;
        }
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
    });
}

/** Total sitting in pots right now — the honest "set aside" figure. */
export const potsTotal = (views: PotView[]) => views.reduce((sum, p) => sum + p.balance, 0);

/**
 * Bills paid from a pot in `month`, as Diff-in-bills rows: what the pot put
 * towards the bill (`bill + diff`) is what was allocated, the bill is what was
 * paid. Settled, that is the whole balance; paid in part, only up to the bill,
 * so a part-payment the pot covers nets to nothing.
 */
export function settlementsIn(data: RentData, month: string) {
  return potViews(data, month)
    .flatMap((p) => p.settlements.map((s) => ({ ...s, key: p.key, label: p.label })))
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
