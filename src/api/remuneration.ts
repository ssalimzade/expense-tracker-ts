import { api } from "./client";
import type { RemunerationRow } from "../types/remuneration";

export const fetchRemuneration = () => api.get<RemunerationRow[]>("/remuneration");

/** `originalPeriod` renames in place — the period doubles as the row's key. */
export const saveRemunerationRow = (row: RemunerationRow, originalPeriod?: string) =>
  api.post<RemunerationRow[]>("/remuneration", { ...row, original_period: originalPeriod });

export const deleteRemunerationRow = (period: string) =>
  api.del<RemunerationRow[]>(`/remuneration/${encodeURIComponent(period)}`);
