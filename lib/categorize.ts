// Port of services/categorize.py. Object key order is preserved (JS keeps
// insertion order for string keys), which matters: the first substring match wins.

export const RENT_UTILITY_CATEGORY = "Rent & Utilities";

export const subCategoryKeywords: Record<string, string[]> = {
  Groceries: ["M&S", "Bens", "Waitrose", "TESCO", "KAVANAGHS", "CO-OP", "SAINSBURY'S"],
  Lunch: ["SALAD KITCHEN", "URBAN FOOD", "ITSU", "MEALPAL", "YACOB's", "Birley"],
  "Going Out": ["FIVE GUYS", "MCDONALDS", "MCDONALD'S"],
  Dating: [
    "WATCHHOUSE", "EUPHORIUM", "UBER EATS", "CAFFE NERO", "GAIL_S", "GELATI",
    "CGCC", "DELIVEROO", "GAIL'S", "SHOP POINT ( NISA )", "RETAIL 24",
    "INE BY TAKU", "SWEET THINGS", "BOULANGERIE", "HAMPSTEAD FOOD",
    "Spaniards", "28 CHURCH ROW", "VENCHI",
  ],
  Shopping: ["PRIMARK", "TK MAXX"],
  Gym: [],
  Football: [],
  Transport: ["TFL.GOV.UK/CP", "UBER LIME", "FOREST"],
  Mobile: ["EE"],
  Barber: [],
  Other: ["APPLE.COM", "Vape Station", "AMAZON"],
  Boots: ["BOOTS", "SUPERDRUG"],
  Coffee: ["GRIND"],
  Travel: [],
  Visits: [],
  Cleaning: [],
};

export const rentSubcategoryKeywords: Record<string, string[]> = {
  Wifi: ["Hyperoptic"],
  Energy: ["Octopus"],
  Water: ["Thames Water"],
  "Council Tax": ["Royal Borough of Greenwich", "Council Tax"],
  Rent: [], // exact-match only, handled below
};

export const subcategoryToCategory: Record<string, string> = {
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
  Wifi: RENT_UTILITY_CATEGORY,
  Energy: RENT_UTILITY_CATEGORY,
  Water: RENT_UTILITY_CATEGORY,
  "Council Tax": RENT_UTILITY_CATEGORY,
  Rent: RENT_UTILITY_CATEGORY,
};

export type Rules = Record<string, { subcategory: string }>;

function normalizeText(value?: string | null): string {
  return (value ?? "").toLowerCase().trim();
}

export function categorizeRow(desc: string, rules: Rules, merchant?: string | null): string {
  const candidates = [normalizeText(desc), normalizeText(merchant)].filter(Boolean);

  // Priority 1: exact match against user rules
  for (const candidate of candidates) {
    for (const [keyword, val] of Object.entries(rules)) {
      if (candidate === normalizeText(keyword)) return val.subcategory;
    }
  }

  // Priority 2: keyword substring match
  for (const candidate of candidates) {
    for (const [subcat, keywords] of Object.entries(subCategoryKeywords)) {
      for (const keyword of keywords) {
        if (subcat === "Mobile" && keyword === "EE") {
          if (/\bEE\b/i.test(candidate)) return subcat;
        } else if (candidate.includes(keyword.toLowerCase())) {
          return subcat;
        }
      }
    }
  }

  // Priority 3: Rent & Utilities ("rent" is exact-match only)
  if (candidates.includes("rent")) return "Rent";
  for (const candidate of candidates) {
    for (const [subcat, keywords] of Object.entries(rentSubcategoryKeywords)) {
      for (const keyword of keywords) {
        if (candidate.includes(keyword.toLowerCase())) return subcat;
      }
    }
  }

  return "Uncategorized";
}

export function categorizeOne(desc: string, rules: Rules, merchant?: string | null): [string, string] {
  const sub = categorizeRow(desc, rules, merchant);
  return [sub, subcategoryToCategory[sub] ?? "Uncategorized"];
}
