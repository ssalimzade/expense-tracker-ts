import { api } from "./client";

export interface BalanceData {
  month: string;
  savings: number;
  monzo: number;
  chase: number;
  amex: number;
  barclays: number;
  diff_in_bills: number;
  diff_in_bills_manual: boolean;
}

export type BalanceValues = Omit<BalanceData, "month">;

export const fetchBalance = (month: string) =>
  api.get<BalanceData>(`/balance/${encodeURIComponent(month)}`);

export const saveBalance = (month: string, values: BalanceValues) =>
  api.put<BalanceData>(`/balance/${encodeURIComponent(month)}`, values);
