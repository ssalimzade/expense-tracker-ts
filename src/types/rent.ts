export interface RentItemDef {
  key: string;
  label: string;
  /** Has a savings pot: money routed to it accrues instead of paying a biller. */
  saved: boolean;
  /**
   * Where a month's money goes when the month doesn't say (see
   * `RentLineItem.to_pot`).
   *
   * A pure pot — Hot Water, which is only ever a set-aside — accrues every
   * month, so it defaults to the pot. A bill that merely saves ahead some
   * months — Water, paid quarterly — defaults to being paid out, and the
   * months that went to the pot say so themselves.
   *
   * Absent means `saved`, which is exactly what the original two pot items
   * relied on before a month could choose, so their history reads unchanged.
   */
  pot_default?: boolean;
}

export interface RentLineItem {
  /** What the bill was budgeted at — the "allocated" side of Diff in bills. */
  amount: number;
  paid: boolean;
  /**
   * What was actually paid, for items ticked by hand (a matched transaction
   * supplies this on its own). Null/absent means "paid exactly what was
   * allocated", so the two stay in step when `amount` is edited later.
   */
  paid_amount?: number | null;
  /**
   * The slice of this bill someone else covers — e.g. rent leaves the account
   * at £1,900 but £200 comes back from a flatmate, so the real cost is £1,700.
   *
   * Deliberately separate from `amount`: the allocation has to keep matching
   * what the bank actually paid, or Diff in bills reads the contribution as a
   * shortfall every month. Netting it here instead keeps that diff at zero
   * while the tab still reports what the month truly cost you.
   */
  contribution?: number | null;
  /**
   * Ignore the auto-matched transaction for this one month — for a match that
   * is simply wrong (a payment that isn't this bill). Not the way to record a
   * shared bill: the link is right there, `contribution` is.
   */
  unlinked?: boolean;
  /**
   * Where this month's money went: true into the item's pot, false out to the
   * biller. Only meaningful on an item that has a pot.
   *
   * Null/absent means the month never said, so the item's `pot_default`
   * answers — which is what every month written before this field existed
   * relies on.
   */
  to_pot?: boolean | null;
}

export type RentMonthEntry = Record<string, RentLineItem>;

/** A real bank payment matched to a Rent line item (auto-marks it paid). */
export interface RentMatch {
  amount: number;
  date: string;
  description: string;
  merchant_name?: string | null;
  /** Stable id of the matched bank transaction (same hash used in the tx list). */
  flag_id?: string;
}

export type RentReconciled = Record<string, Record<string, RentMatch>>; // month -> key -> match

/**
 * Closing off a pot: the quarterly bill landed, so whatever had accrued is
 * spent. `bill` under the accrued balance leaves a surplus that stays in
 * savings; over it, the shortfall comes out of savings. Either way the pot
 * restarts from zero the following month.
 */
export interface RentPotSettlement {
  month: string; // "YYYY-MM" — when the bill landed
  bill: number; // what the bill actually came to (0 = nothing to pay)
  note?: string;
}

export type RentPots = Record<string, { settlements: RentPotSettlement[] }>;

export interface RentData {
  items: RentItemDef[];
  months: Record<string, RentMonthEntry>; // keyed by "YYYY-MM"
  reconciled?: RentReconciled;
  /**
   * Matches the user unlinked, set aside rather than dropped so the table can
   * still offer to relink them. Filled in client-side by `useRent`; the server
   * never sends it.
   */
  unlinked_matches?: RentReconciled;
  /** Settlement history per saved item — absent until a pot is first settled. */
  pots?: RentPots;
}
