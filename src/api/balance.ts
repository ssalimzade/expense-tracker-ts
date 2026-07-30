import { api } from "./client";

export interface BalanceData {
  month: string;
  savings: number;
  monzo: number;
  chase: number;
  amex: number;
  hsbc: number;
  diff_in_bills: number;
  diff_in_bills_manual: boolean;
  monzo_manual: boolean;
  chase_manual: boolean;
  hsbc_manual: boolean;
  amex_manual: boolean;
}

/** Live account balances keyed by source (monzo/chase/hsbc/amex). */
export type AccountBalances = Partial<Record<"monzo" | "chase" | "hsbc" | "amex", number>>;

export const fetchAccountBalances = () => api.get<AccountBalances>("/account-balances");

export type BalanceValues = Omit<BalanceData, "month">;

export const fetchBalance = (month: string) =>
  api.get<BalanceData>(`/balance/${encodeURIComponent(month)}`);

export const saveBalance = (month: string, values: BalanceValues) =>
  api.put<BalanceData>(`/balance/${encodeURIComponent(month)}`, values);
