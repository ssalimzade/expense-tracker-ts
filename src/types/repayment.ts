export interface Repayment {
  id: string; // hash id (flags / deleted use this)
  flex_id: string; // bank id, used for DB updates
  created: string;
  description: string;
  amount: number;
  category: string;
  notes: string;
  refunded: boolean;
  repayment_1_date: string | null;
  repayment_1_amount: number | null;
  repayment_2_date: string | null;
  repayment_2_amount: number | null;
  repayment_3_date: string | null;
  repayment_3_amount: number | null;
}

// A synthetic Monzo row created from a month's repayment totals so Flex
// repayments count as spend on the dashboard.
export interface SyntheticRepayment {
  id: string;
  month: string; // "YYYY-MM"
  created: string;
  category: string;
  amount: number; // negative (stored as spend)
}

export interface RepaymentUpdate {
  flex_id: string;
  category?: string;
  notes?: string;
  refunded?: boolean;
  repayment_1_date?: string | null;
  repayment_1_amount?: number | null;
  repayment_2_date?: string | null;
  repayment_2_amount?: number | null;
  repayment_3_date?: string | null;
  repayment_3_amount?: number | null;
}
