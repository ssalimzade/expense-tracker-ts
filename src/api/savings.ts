import { api } from "./client";
import type { SavingsRow } from "../types/savings";

export const fetchSavings = () => api.get<SavingsRow[]>("/savings");

export const saveSavingsRow = (row: Partial<SavingsRow>) =>
  api.post<SavingsRow[]>("/savings", row);
