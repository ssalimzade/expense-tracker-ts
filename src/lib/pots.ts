import type { RentData, RentPotSettlement } from "../types/rent";

/**
 * Bills pots: the money set aside each month for the quarterly bills (the
 * `saved` rent items). It lives in the savings account, but it is earmarked.
 *
 * Money enters a pot when a month's allocation is actually moved across — i.e.
 * the row is ticked or matched, not merely budgeted. Money leaves when the bill
 * lands and the pot is settled: the balance that had accrued pays the bill, any
 * surplus stays in savings, any shortfall comes out of it, and the pot restarts
 * from zero.
 *
 * Settlements therefore partition the timeline, and a pot's live balance is
 * whatever has accrued since the last one.
 */

/** What actually reached the pot for one month — 0 until the money moves. */
export function potInflow(data: RentData, key: string, month: string): number {
  const matched = data.reconciled?.[month]?.[key]?.amount;
  if (matched != null) return matched;
  const cell = data.months?.[month]?.[key];
  if (!cell?.paid) return 0;
  return cell.paid_amount ?? cell.amount ?? 0;
}

export interface PotSettlementView extends RentPotSettlement {
  /** Balance the pot had reached when this settlement closed it off. */
  accrued: number;
  /** accrued − bill: positive stays in savings, negative comes out of it. */
  diff: number;
}

export interface PotView {
  key: string;
  label: string;
  /** Accrued since the last settlement, up to and including `upTo`. */
  balance: number;
  settlements: PotSettlementView[];
  lastSettled?: string;
  /** Settled, and nothing has gone in since — safe to retire from the table. */
  closed: boolean;
}

/**
 * One view per saved item. `upTo` bounds the balance to months that have
 * actually happened, so future allocations don't inflate it.
 */
export function potViews(data: RentData, upTo: string): PotView[] {
  const months = Object.keys(data.months ?? {}).sort();

  return (data.items ?? [])
    .filter((it) => it.saved)
    .map((it) => {
      const settlements = [...(data.pots?.[it.key]?.settlements ?? [])].sort((a, b) =>
        a.month < b.month ? -1 : a.month > b.month ? 1 : 0,
      );

      // Walk the months once, banking the running total at each settlement.
      let running = 0;
      let si = 0;
      const view: PotSettlementView[] = [];
      for (const m of months) {
        if (m > upTo) break;
        running += potInflow(data, it.key, m);
        while (si < settlements.length && settlements[si].month <= m) {
          const s = settlements[si++];
          view.push({ ...s, accrued: running, diff: running - s.bill });
          running = 0; // the bill is paid; the remainder leaves the pot
        }
      }
      // Settlements dated beyond the months we hold still close the pot.
      while (si < settlements.length && settlements[si].month <= upTo) {
        const s = settlements[si++];
        view.push({ ...s, accrued: running, diff: running - s.bill });
        running = 0;
      }

      const lastSettled = view.length ? view[view.length - 1].month : undefined;
      return {
        key: it.key,
        label: it.label,
        balance: running,
        settlements: view,
        lastSettled,
        closed: lastSettled != null && running === 0,
      };
    });
}

/** Total sitting in pots right now — the honest "set aside" figure. */
export const potsTotal = (views: PotView[]) => views.reduce((sum, p) => sum + p.balance, 0);

/**
 * Settlements that closed in `month`, as Diff-in-bills rows: the pot balance is
 * what was allocated, the bill is what was paid.
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
