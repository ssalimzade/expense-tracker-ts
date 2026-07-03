import { api } from "./client";
import type { Repayment, RepaymentUpdate, SyntheticRepayment } from "../types/repayment";

export const fetchRepayments = () => api.get<Repayment[]>("/repayments");

export const fetchSyntheticRepayments = () =>
  api.get<SyntheticRepayment[]>("/repayments/synthetic");

export const syncSyntheticRepayments = (month: string, force = false) =>
  api.post<SyntheticRepayment[]>("/repayments/synthetic/sync", { month, force });

export const deleteSyntheticRepayments = (month: string) =>
  api.del(`/repayments/synthetic/${month}`);

export const fetchRepaymentCategories = () =>
  api.get<string[]>("/repayment-categories");

export const addRepaymentCategory = (name: string) =>
  api.post<string[]>("/repayment-categories", { name });

export const saveRepayment = (update: RepaymentUpdate) =>
  api.post<Repayment>("/repayments", update);

export const deleteRepayment = (id: string) =>
  api.del(`/repayments/${id}`);

export const restoreRepayment = (id: string) =>
  api.post(`/repayments/${id}/restore`, {});
