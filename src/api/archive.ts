import { api } from "./client";
import type { Archive } from "../types/archive";

export const fetchArchiveMonths = () => api.get<string[]>("/archive");

export const fetchArchive = (month: string) =>
  api.get<Archive>(`/archive/${month}`);

export const saveArchive = (month: string, rows: Archive) =>
  api.post(`/archive/${month}`, rows);

export const recomputeArchive = (month: string) =>
  api.post<{ ok: boolean; month: string }>(`/archive/${month}/recompute`, {});
