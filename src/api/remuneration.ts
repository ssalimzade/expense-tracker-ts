import { api } from "./client";
import type { RemunerationRow } from "../types/remuneration";

export const fetchRemuneration = () => api.get<RemunerationRow[]>("/remuneration");

export const saveRemunerationRow = (row: RemunerationRow) =>
  api.post<RemunerationRow[]>("/remuneration", row);
