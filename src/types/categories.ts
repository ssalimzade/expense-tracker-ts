// Canonical category lists, mirrored from backend services/categorize.py.

export const SUBCATEGORIES = [
  "Groceries",
  "Lunch",
  "Going Out",
  "Dating",
  "Shopping",
  "Gym",
  "Football",
  "Transport",
  "Mobile",
  "Barber",
  "Other",
  "Boots",
  "Coffee",
  "Travel",
  "Visits",
  "Cleaning",
] as const;

export type Subcategory = (typeof SUBCATEGORIES)[number];

// Rent & Utilities sub-categories. Mirrored from backend categorize.py. They map
// to RENT_UTILITY_CATEGORY and are deliberately excluded from the dashboard and
// budgeting (see lib/spend.ts) — only the Rent tab consumes them. They are still
// offered in the transactions tab so a row can be assigned to one manually.
export const RENT_UTILITY_CATEGORY = "Rent & Utilities";

export const RENT_SUBCATEGORIES = [
  "Rent",
  "Wifi",
  "Energy",
  "Water",
  "Council Tax",
] as const;

export const MAIN_CATEGORIES = [
  "Groceries",
  "Lunch",
  "Social Life",
  "Shopping",
  "Sports",
  "Transport",
  "Mobile",
  "Barber",
  "Other",
  "Travel",
] as const;

export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export const SUBCATEGORY_TO_CATEGORY: Record<string, MainCategory> = {
  Groceries: "Groceries",
  Lunch: "Lunch",
  "Going Out": "Social Life",
  Dating: "Social Life",
  Shopping: "Shopping",
  Gym: "Sports",
  Football: "Sports",
  Transport: "Transport",
  Mobile: "Mobile",
  Barber: "Barber",
  Other: "Other",
  Boots: "Other",
  Coffee: "Other",
  Travel: "Travel",
  Visits: "Travel",
  Cleaning: "Other",
};
