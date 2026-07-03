import { api } from "./client";
import type { RentData, RentMonthEntry } from "../types/rent";

export const fetchRent = () => api.get<RentData>("/rent");

export const saveRentMonth = (month: string, entry: RentMonthEntry) =>
  api.post<RentData>("/rent", { month, entry });
