export type Source = "monzo" | "flex" | "amex" | "chase";

export interface Transaction {
  id: string;
  flag_id: string; // stable hash id used for one-time flags
  created: string; // ISO 8601
  description: string;
  amount: number; // negative = spend
  currency: string;
  merchant_name: string | null;
  status: string;
  source: Source;
  // computed on backend:
  subcategory: string;
  category: string;
  notes: string;
  one_time: boolean;
}

export interface FlagUpdate {
  month: string;
  notes?: string;
  subcategory?: string;
  one_time?: boolean;
}
