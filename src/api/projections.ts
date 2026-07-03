import { api } from "./client";
import type { ProjectionRow } from "../types/projections";

export const fetchProjections = () => api.get<ProjectionRow[]>("/projections");

export const saveProjectionRow = (row: ProjectionRow) =>
  api.post<ProjectionRow[]>("/projections", row);
