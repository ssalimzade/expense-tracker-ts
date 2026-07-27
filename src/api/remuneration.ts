import { api } from "./client";
import type { RemunerationRow } from "../types/remuneration";

export const fetchRemuneration = () => api.get<RemunerationRow[]>("/remuneration");

/**
 * `originalPeriod` renames in place — the period doubles as the row's key.
 * `index` puts a row back at a given position, used when undoing a delete.
 */
export const saveRemunerationRow = (
  row: RemunerationRow,
  originalPeriod?: string,
  index?: number,
) => api.post<RemunerationRow[]>("/remuneration", { ...row, original_period: originalPeriod, index });

export const deleteRemunerationRow = (period: string) =>
  api.del<RemunerationRow[]>(`/remuneration/${encodeURIComponent(period)}`);
