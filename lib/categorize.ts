// Port of services/categorize.py. Object key order is preserved (JS keeps
// insertion order for string keys), which matters: the first keyword match wins.

export const RENT_UTILITY_CATEGORY = "Rent & Utilities";

export const subCategoryKeywords: Record<string, string[]> = {
  Groceries: [
    "M&S", "MARKS&SPENCER", "MARKS AND SPENCER", "Bens", "Waitrose", "TESCO",
    "KAVANAGHS", "CO-OP", "SAINSBURY'S", "SAINSBURYS",
  ],
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

/**
 * Banks spell the same merchant several ways: HSBC sends "CO- OP GROUP FOOD
 * LONDON GB" one day and "CO-OP GROUP FOOD R LONDON GB" the next, where Monzo
 * sends a tidy merchant_name. Raw substring matching missed those, so both
 * descriptions and keywords are reduced to lower-case words with punctuation
 * treated as a separator — "CO-OP", "CO- OP" and "Co Op" all become ["co","op"].
 */
function toWords(value?: string | null): string[] {
  return (value ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function normalizeText(value?: string | null): string {
  return toWords(value).join(" ");
}

// Keyword lists are static, so their word forms are only computed once.
const wordCache = new Map<string, string[]>();
function keywordWords(keyword: string): string[] {
  let words = wordCache.get(keyword);
  if (!words) wordCache.set(keyword, (words = toWords(keyword)));
  return words;
}

/**
 * True when `needle` appears in `haystack` as consecutive whole words. Whole
 * words matter now that punctuation is stripped: "M&S" becomes ["m","s"], which
 * as a plain substring would also hit "PROGRAM SOMETHING".
 */
function containsWords(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    let hit = true;
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return true;
  }
  return false;
}

export function categorizeRow(desc: string, rules: Rules, merchant?: string | null): string {
  const candidates = [toWords(desc), toWords(merchant)].filter((w) => w.length);

  // Priority 1: exact match against user rules
  for (const candidate of candidates) {
    const joined = candidate.join(" ");
    for (const [keyword, val] of Object.entries(rules)) {
      if (joined === normalizeText(keyword)) return val.subcategory;
    }
  }

  // Priority 2: keyword match on whole words
  for (const candidate of candidates) {
    for (const [subcat, keywords] of Object.entries(subCategoryKeywords)) {
      for (const keyword of keywords) {
        if (containsWords(candidate, keywordWords(keyword))) return subcat;
      }
    }
  }

  // Priority 3: Rent & Utilities ("rent" is exact-match only)
  if (candidates.some((c) => c.length === 1 && c[0] === "rent")) return "Rent";
  for (const candidate of candidates) {
    for (const [subcat, keywords] of Object.entries(rentSubcategoryKeywords)) {
      for (const keyword of keywords) {
        if (containsWords(candidate, keywordWords(keyword))) return subcat;
      }
    }
  }

  return "Uncategorized";
}

export function categorizeOne(desc: string, rules: Rules, merchant?: string | null): [string, string] {
  const sub = categorizeRow(desc, rules, merchant);
  return [sub, subcategoryToCategory[sub] ?? "Uncategorized"];
}
