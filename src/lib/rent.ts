import type { RentData, RentLineItem, RentMatch } from "../types/rent";

/**
 * How a rent line item resolves to money.
 *
 * Two different numbers hide behind one cell, and keeping them straight is the
 * whole point of this module:
 *
 *   bill  — what the bank actually moved. Must stay equal to the matched
 *           transaction, because Diff in bills compares it against exactly that.
 *   share — what the month really cost you: the bill minus whatever someone
 *           else covers. This is what the tab reports.
 *
 * With no contribution set the two are identical, which is every month before
 * a bill was ever split.
 */

export const blankRentItem: RentLineItem = { amount: 0, paid: false };

export const rentCell = (data: RentData, month: string, key: string): RentLineItem =>
  data.months?.[month]?.[key] ?? blankRentItem;

/**
 * The matched bank transaction, unless this month was explicitly unlinked.
 *
 * `useRent` already strips unlinked matches from `reconciled` as the data
 * arrives, so this is belt-and-braces for any caller holding raw server data.
 */
export const rentMatch = (data: RentData, month: string, key: string): RentMatch | undefined =>
  rentCell(data, month, key).unlinked ? undefined : data.reconciled?.[month]?.[key];

/** What the bill came to: matched transaction wins, then hand-entered paid, else allocation. */
export function rentBill(data: RentData, month: string, key: string): number {
  const matched = rentMatch(data, month, key)?.amount;
  if (matched != null) return matched;
  const cell = rentCell(data, month, key);
  return cell.paid ? cell.paid_amount ?? cell.amount : cell.amount;
}

/** The slice someone else covers. Never exceeds the bill, so `rentShare` can't go negative. */
export function rentContribution(data: RentData, month: string, key: string): number {
  const raw = rentCell(data, month, key).contribution ?? 0;
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, rentBill(data, month, key));
}

/** What the bill actually cost you — the number the rent tab reports throughout. */
export const rentShare = (data: RentData, month: string, key: string): number =>
  rentBill(data, month, key) - rentContribution(data, month, key);

/** Effective paid = ticked by hand, or a matching transaction exists. */
export const rentIsPaid = (data: RentData, month: string, key: string): boolean =>
  rentCell(data, month, key).paid || !!rentMatch(data, month, key);
