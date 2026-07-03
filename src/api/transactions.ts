import { api } from "./client";
import type { Transaction, FlagUpdate } from "../types/transaction";

export const fetchTransactions = (month: string) =>
  api.get<Transaction[]>(`/transactions?month=${encodeURIComponent(month)}`);

export const setTransactionFlag = (flagId: string, update: FlagUpdate) =>
  api.post(`/transactions/${flagId}/flag`, update);

export const deleteTransactionFlag = (flagId: string, month: string) =>
  api.del(`/transactions/${flagId}/flag?month=${encodeURIComponent(month)}`);
