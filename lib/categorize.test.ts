import { describe, expect, it } from "vitest";
import {
  categorizeOne,
  categorizeRow,
  rentSubcategoryKeywords,
  ruleKeyFor,
  subCategoryKeywords,
  subcategoryToCategory,
  RENT_UTILITY_CATEGORY,
  type Rules,
} from "./categorize";

const NO_RULES: Rules = {};
const SINCE = "2026-08-10T12:00:00";
const BEFORE = "2026-08-09T23:59:59";
const AFTER = "2026-08-11T09:00:00";

describe("tokenisation — punctuation is a separator", () => {
  it("matches CO-OP however the bank spells it", () => {
    for (const desc of [
      "CO-OP GROUP FOOD LONDON GB",
      "CO- OP GROUP FOOD R LONDON GB",
      "Co Op Group Food",
    ]) {
      expect(categorizeRow(desc, NO_RULES)).toBe("Groceries");
    }
  });

  it("matches M&S in each of its spellings", () => {
    expect(categorizeRow("M&S SIMPLY FOOD", NO_RULES)).toBe("Groceries");
    expect(categorizeRow("MARKS&SPENCER LONDON", NO_RULES)).toBe("Groceries");
    expect(categorizeRow("MARKS AND SPENCER PLC", NO_RULES)).toBe("Groceries");
  });

  it("matches a multi-word keyword across punctuation", () => {
    expect(categorizeRow("SHOP POINT ( NISA ) N19", NO_RULES)).toBe("Dating");
  });

  it("is case-insensitive", () => {
    expect(categorizeRow("waitrose st pancras", NO_RULES)).toBe("Groceries");
  });
});

describe("whole-word matching", () => {
  // "M&S" reduces to ["m","s"]; as a plain substring that would hit all sorts
  // of unrelated text, so the words have to line up as consecutive whole words.
  it("does not let short keywords match inside other words", () => {
    expect(categorizeRow("PROGRAMS SYSTEM", NO_RULES)).toBe("Uncategorized");
  });

  it("matches EE as its own word but not inside 'coffee'", () => {
    expect(categorizeRow("EE LIMITED", NO_RULES)).toBe("Mobile");
    expect(categorizeRow("DD EE", NO_RULES)).toBe("Mobile");
    expect(categorizeRow("COFFEE SHOP", NO_RULES)).toBe("Uncategorized");
  });

  it("matches PRET as its own word but not inside 'pretty'", () => {
    expect(categorizeRow("PRET A MANGER LONDON", NO_RULES)).toBe("Lunch");
    expect(categorizeRow("PRETTY THINGS LTD", NO_RULES)).toBe("Uncategorized");
  });
});

// The module's opening comment makes insertion order part of the contract:
// the first subcategory whose keyword hits wins. Alphabetising the object would
// silently recategorise history.
describe("keyword order", () => {
  it("resolves a two-keyword description by key order, not by position in the text", () => {
    // Groceries ("TESCO") is declared before Boots ("BOOTS").
    expect(categorizeRow("TESCO BOOTS", NO_RULES)).toBe("Groceries");
    expect(categorizeRow("BOOTS TESCO", NO_RULES)).toBe("Groceries");
  });
});

describe("merchant fallback", () => {
  it("falls back to the merchant when the description matches nothing", () => {
    expect(categorizeRow("CARD PAYMENT", NO_RULES, "TESCO")).toBe("Groceries");
  });

  it("prefers the description over the merchant when both match", () => {
    expect(categorizeRow("TESCO", NO_RULES, "PRIMARK")).toBe("Groceries");
  });

  it("tolerates a null or absent merchant", () => {
    expect(categorizeRow("TESCO", NO_RULES, null)).toBe("Groceries");
    expect(categorizeRow("TESCO", NO_RULES)).toBe("Groceries");
  });
});

describe("rent & utilities", () => {
  it("treats 'rent' as a whole description on its own", () => {
    expect(categorizeRow("rent", NO_RULES)).toBe("Rent");
    expect(categorizeRow("RENT", NO_RULES)).toBe("Rent");
  });

  it("does not match 'rent' as part of a longer description", () => {
    expect(categorizeRow("RENT PAYMENT", NO_RULES)).toBe("Uncategorized");
    expect(categorizeRow("CURRENT ACCOUNT", NO_RULES)).toBe("Uncategorized");
  });

  it("matches the utility providers", () => {
    expect(categorizeRow("Hyperoptic Ltd", NO_RULES)).toBe("Wifi");
    expect(categorizeRow("OCTOPUS ENERGY", NO_RULES)).toBe("Energy");
    expect(categorizeRow("THAMES WATER LTD", NO_RULES)).toBe("Water");
    expect(categorizeRow("Royal Borough of Greenwich", NO_RULES)).toBe("Council Tax");
    expect(categorizeRow("COUNCIL TAX FEB", NO_RULES)).toBe("Council Tax");
  });

  it("runs after the ordinary keyword lists", () => {
    expect(categorizeRow("TESCO OCTOPUS", NO_RULES)).toBe("Groceries");
  });
});

describe("user rules — gap fill", () => {
  const rules: Rules = { "SOME RANDOM SHOP": { subcategory: "Shopping" } };

  it("fills in where the keyword lists have no answer", () => {
    expect(categorizeRow("SOME RANDOM SHOP", rules)).toBe("Shopping");
  });

  it("never overwrites an answer the keywords already gave", () => {
    // A rule with no `since` is gap-fill only, so TESCO stays Groceries.
    expect(categorizeRow("TESCO", { TESCO: { subcategory: "Shopping" } })).toBe("Groceries");
  });

  it("stays gap-fill when the rule has a `since` but the row has no timestamp", () => {
    const withSince: Rules = { TESCO: { subcategory: "Shopping", since: SINCE } };
    expect(categorizeRow("TESCO", withSince)).toBe("Groceries");
  });

  it("applies to the merchant as well as the description", () => {
    expect(categorizeRow("CARD PAYMENT 1234", { "MY SHOP": { subcategory: "Travel" } }, "MY SHOP"))
      .toBe("Travel");
  });
});

describe("user rules — `since` outranks the keyword lists", () => {
  const rules: Rules = { TESCO: { subcategory: "Shopping", since: SINCE } };

  it("wins on a row that arrived after the rule was saved", () => {
    expect(categorizeRow("TESCO", rules, null, AFTER)).toBe("Shopping");
  });

  it("wins on a row that arrived at the same second", () => {
    expect(categorizeRow("TESCO", rules, null, SINCE)).toBe("Shopping");
  });

  it("leaves an older row on the keyword answer", () => {
    expect(categorizeRow("TESCO", rules, null, BEFORE)).toBe("Groceries");
  });

  it("still gap-fills an older row the keywords cannot place", () => {
    const gap: Rules = { "SOME RANDOM SHOP": { subcategory: "Shopping", since: SINCE } };
    expect(categorizeRow("SOME RANDOM SHOP", gap, null, BEFORE)).toBe("Shopping");
  });

  it("compares timestamps at second precision, ignoring millis and the Z suffix", () => {
    expect(categorizeRow("TESCO", rules, null, "2026-08-10T12:00:00.482Z")).toBe("Shopping");
    expect(categorizeRow("TESCO", rules, null, "2026-08-10T11:59:59.999Z")).toBe("Groceries");
  });
});

describe("rules match the whole normalised description", () => {
  it("ignores punctuation differences between the key and the row", () => {
    const rules: Rules = { "CO- OP GROUP FOOD": { subcategory: "Other", since: SINCE } };
    expect(categorizeRow("CO-OP GROUP FOOD", rules, null, AFTER)).toBe("Other");
  });

  it("does not fire on a description that merely contains the key", () => {
    const rules: Rules = { TESCO: { subcategory: "Shopping", since: SINCE } };
    expect(categorizeRow("TESCO EXPRESS", rules, null, AFTER)).toBe("Groceries");
  });
});

describe("ruleKeyFor", () => {
  const rules: Rules = { "CO- OP GROUP FOOD": { subcategory: "Other" } };

  it("finds the stored key from a differently punctuated description", () => {
    expect(ruleKeyFor("CO-OP Group Food", rules)).toBe("CO- OP GROUP FOOD");
  });

  it("is undefined when no rule matches", () => {
    expect(ruleKeyFor("TESCO", rules)).toBeUndefined();
  });
});

describe("fallbacks", () => {
  it("returns Uncategorized for an unrecognised description", () => {
    expect(categorizeRow("SOME RANDOM SHOP", NO_RULES)).toBe("Uncategorized");
  });

  it("returns Uncategorized for an empty description", () => {
    expect(categorizeRow("", NO_RULES)).toBe("Uncategorized");
    expect(categorizeRow("   ", NO_RULES)).toBe("Uncategorized");
  });
});

describe("categorizeOne", () => {
  it("pairs the subcategory with its parent category", () => {
    expect(categorizeOne("TESCO", NO_RULES)).toEqual(["Groceries", "Groceries"]);
    expect(categorizeOne("FIVE GUYS", NO_RULES)).toEqual(["Going Out", "Social Life"]);
    expect(categorizeOne("BOOTS", NO_RULES)).toEqual(["Boots", "Other"]);
  });

  it("maps rent subcategories to Rent & Utilities", () => {
    expect(categorizeOne("rent", NO_RULES)).toEqual(["Rent", RENT_UTILITY_CATEGORY]);
    expect(categorizeOne("OCTOPUS ENERGY", NO_RULES)).toEqual(["Energy", RENT_UTILITY_CATEGORY]);
  });

  it("passes the timestamp through to the rule check", () => {
    const rules: Rules = { TESCO: { subcategory: "Travel", since: SINCE } };
    expect(categorizeOne("TESCO", rules, null, AFTER)).toEqual(["Travel", "Travel"]);
    expect(categorizeOne("TESCO", rules, null, BEFORE)).toEqual(["Groceries", "Groceries"]);
  });

  it("returns Uncategorized for both halves when nothing matches", () => {
    expect(categorizeOne("SOME RANDOM SHOP", NO_RULES)).toEqual([
      "Uncategorized",
      "Uncategorized",
    ]);
  });

  it("falls back to Uncategorized for a rule naming an unmapped subcategory", () => {
    expect(categorizeOne("X", { X: { subcategory: "Nonsense" } })).toEqual([
      "Nonsense",
      "Uncategorized",
    ]);
  });
});

// Guards the whole class of "added a subcategory, forgot the mapping" bug —
// without a parent category, every matching transaction silently lands in
// Uncategorized and drops out of the dashboard.
describe("category map completeness", () => {
  it("maps every ordinary subcategory to a parent category", () => {
    const unmapped = Object.keys(subCategoryKeywords).filter((k) => !subcategoryToCategory[k]);
    expect(unmapped).toEqual([]);
  });

  it("maps every rent subcategory to Rent & Utilities", () => {
    for (const key of Object.keys(rentSubcategoryKeywords)) {
      expect(subcategoryToCategory[key]).toBe(RENT_UTILITY_CATEGORY);
    }
  });
});
