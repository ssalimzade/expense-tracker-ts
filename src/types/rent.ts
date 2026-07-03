export interface RentItemDef {
  key: string;
  label: string;
  /** Quarterly bill set aside to a savings pot each month. */
  saved: boolean;
}

export interface RentLineItem {
  amount: number;
  paid: boolean;
}

export type RentMonthEntry = Record<string, RentLineItem>;

/** A real bank payment matched to a Rent line item (auto-marks it paid). */
export interface RentMatch {
  amount: number;
  date: string;
  description: string;
}

export type RentReconciled = Record<string, Record<string, RentMatch>>; // month -> key -> match

export interface RentData {
  items: RentItemDef[];
  months: Record<string, RentMonthEntry>; // keyed by "YYYY-MM"
  reconciled?: RentReconciled;
}
