import { api } from "./client";
import type { RequisitionStatus } from "../types/requisitions";

export const fetchRequisitionStatus = () =>
  api.get<RequisitionStatus[]>("/requisition-status");
