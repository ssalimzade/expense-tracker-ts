// Port of services/categorize.py. Object key order is preserved (JS keeps
// insertion order for string keys), which matters: the first keyword match wins.

export const RENT_UTILITY_CATEGORY = "Rent & Utilities";

export const subCategoryKeywords: Record<string, string[]> = {
  Groceries: [
    "M&S", "MARKS&SPENCER", "MARKS AND SPENCER", "Bens", "Waitrose", "TESCO",
    "KAVANAGHS", "CO-OP", "SAINSBURY'S", "SAINSBURYS",
  ],
  // "PRET" alone, not "PRET A MANGER": the branch and city trail the name in
  // every spelling the banks send, and whole-word matching keeps it off
  // anything else.
  Lunch: ["SALAD KITCHEN", "URBAN FOOD", "ITSU", "MEALPAL", "YACOB's", "Birley", "PRET"],
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

export type Rules = Record<
  string,
  {
    subcategory: string;
    /**
     * When the rule was saved, second-precision and in the same shape as a
     * transaction's `created`. A rule only outranks the keyword list for rows
     * that arrived after this moment. Absent on rules stored before it was
     * recorded, which are treated as gap-fill only.
     */
    since?: string;
  }
>;

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

/** The rule whose description matches this row exactly, if there is one. */
function matchingRule(candidates: string[][], rules: Rules): Rules[string] | undefined {
  for (const candidate of candidates) {
    const joined = candidate.join(" ");
    for (const [keyword, val] of Object.entries(rules)) {
      if (joined === normalizeText(keyword)) return val;
    }
  }
  return undefined;
}

/** The keyword lists' own answer, ignoring user rules. */
function byKeywords(candidates: string[][]): string {
  for (const candidate of candidates) {
    for (const [subcat, keywords] of Object.entries(subCategoryKeywords)) {
      for (const keyword of keywords) {
        if (containsWords(candidate, keywordWords(keyword))) return subcat;
      }
    }
  }

  // Rent & Utilities ("rent" is exact-match only)
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

// Timestamps are compared as text, so both sides are cut to the same
// second-precision shape first: `created` arrives as 2026-08-29T23:08:00 and an
// ISO stamp carries milliseconds and a Z on the end.
const stamp = (value: string) => value.slice(0, 19);

/**
 * `createdIso` — when the row arrived, in the same shape as `created`. Rules
 * outrank the keyword lists only from the moment they were saved onward; a row
 * without a timestamp (or a rule saved before they were recorded) gets the
 * gap-fill treatment described below.
 */
export function categorizeRow(
  desc: string,
  rules: Rules,
  merchant?: string | null,
  createdIso?: string | null,
): string {
  const candidates = [toWords(desc), toWords(merchant)].filter((w) => w.length);
  const rule = matchingRule(candidates, rules);

  // A rule pins one exact description, and several rows can carry it — two
  // visits to the same shop on one day, or every month's copy of a standing
  // payment. Letting a rule reach backwards re-categorised those neighbours
  // behind the user's back: setting one CO-OP row to Other moved the other one
  // off Groceries too, and nothing on screen explained why. So a rule only
  // outranks the keyword lists for rows that arrived after it was saved. On
  // older rows it may fill a gap the keywords leave — which is what makes
  // categorising one Uncategorized row catch its siblings — but never overwrite
  // an answer they already gave. The row the user actually picked carries its
  // own per-row override, so it changes either way.
  if (rule?.since && createdIso && stamp(createdIso) >= stamp(rule.since)) {
    return rule.subcategory;
  }

  const keyword = byKeywords(candidates);
  return keyword === "Uncategorized" ? rule?.subcategory ?? "Uncategorized" : keyword;
}

export function categorizeOne(
  desc: string,
  rules: Rules,
  merchant?: string | null,
  createdIso?: string | null,
): [string, string] {
  const sub = categorizeRow(desc, rules, merchant, createdIso);
  return [sub, subcategoryToCategory[sub] ?? "Uncategorized"];
}
