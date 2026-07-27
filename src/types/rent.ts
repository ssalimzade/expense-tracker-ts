export interface RentItemDef {
  key: string;
  label: string;
  /** Quarterly bill set aside to a savings pot each month. */
  saved: boolean;
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

export interface RentData {
  items: RentItemDef[];
  months: Record<string, RentMonthEntry>; // keyed by "YYYY-MM"
  reconciled?: RentReconciled;
}
