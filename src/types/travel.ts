export const TRAVEL_CATEGORIES = [
  "Flights", "Accommodation", "Food & Drink", "Transport", "Activities", "Shopping", "Other",
] as const;

export type TravelCategory = (typeof TRAVEL_CATEGORIES)[number];

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start_date: string; // YYYY-MM-DD, "" when not set
  end_date: string;
  /**
   * Local currencies, main one first, each with its rate: units per £1
   * ("£1 = 1.17 EUR" stores 1.17). Never includes GBP, which is always
   * available. Missing on trips saved before multi-currency — read it through
   * `tripCurrencies`, never directly.
   */
  currencies?: TripCurrency[];
  /** The main local currency ("GBP" if none) and its rate, mirrored from `currencies[0]`. */
  currency: string;
  rate: number;
  /** Planned spend in pounds; 0 means no budget. */
  budget: number;
  /** Spending estimates per category, in pounds. */
  plan?: Partial<Record<TravelCategory, PlanLine>>;
  created_at: string;
  updated_at: string;
}

export type PaidWith = "card" | "flex";

export interface TripCurrency {
  code: string;
  rate: number;
}

export interface PlanLine {
  amount: number;
  /** Per day of the trip, or once for the whole trip. */
  per_day: boolean;
}

export interface TripExpense {
  id: string;
  trip_id: string;
  date: string;
  description: string;
  category: TravelCategory;
  amount: number;
  /** Currency the amount is in: "GBP" or one of the trip's. Missing on older expenses — use `expenseCurrency`. */
  currency?: string;
  /** Older flag for "entered in pounds"; superseded by `currency`. */
  in_gbp: boolean;
  /** How a hand-entered expense was paid; linked ones follow their source (see `paidWith`). */
  paid_with?: PaidWith;
  /** People it's split between (1 or missing = not split); your share is amount / split. */
  split?: number;
  /**
   * Set when linked from a bank transaction or Flex purchase: "<source>:<bank row
   * id>". A linked expense is a copy — amount, date, description and category
   * are stored here — and this ref is only used to stop the same transaction
   * being linked twice. Nothing reads the source row back, so the expense stays
   * even after the repayment is paid off or the transaction disappears.
   */
  tx_ref?: string;
  created_at: string;
  updated_at: string;
}

export interface TravelData {
  trips: Trip[];
  expenses: TripExpense[];
}
