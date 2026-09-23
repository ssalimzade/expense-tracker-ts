import { api } from "./client";
import type { RentData, RentMonthEntry, RentPotSettlement } from "../types/rent";

export const fetchRent = () => api.get<RentData>("/rent");

export const saveRentMonth = (month: string, entry: RentMonthEntry) =>
  api.post<RentData>("/rent", { month, entry });

export const saveRentPot = (key: string, settlements: RentPotSettlement[]) =>
  api.post<RentData>("/rent/pot", { key, settlements });

/** Add a line item, or change one — chiefly to give it a pot or take one away. */
export const saveRentItem = (item: {
  key?: string;
  label: string;
  saved: boolean;
  pot_default?: boolean;
  delete?: boolean;
}) => api.post<RentData>("/rent/item", item);
