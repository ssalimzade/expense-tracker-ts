import { api } from "./client";

// Per-month hidden transaction flag_ids, stored in Neon so they sync across
// every device (previously localStorage, which was per-browser).
export type HiddenMap = Record<string, string[]>;

export const fetchHidden = () => api.get<HiddenMap>("/hidden");

export const saveHiddenMonth = (month: string, ids: string[]) =>
  api.put<HiddenMap>(`/hidden/${encodeURIComponent(month)}`, ids);
