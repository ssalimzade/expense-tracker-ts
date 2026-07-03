import { api } from "./client";
import type { WorksheetDoc } from "../types/worksheet";

export const fetchWorksheet = () => api.get<WorksheetDoc>("/worksheet");

export const saveWorksheet = (doc: WorksheetDoc) =>
  api.put<WorksheetDoc>("/worksheet", doc);
