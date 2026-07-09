import type { Repayment } from "../types/repayment";

// Fixed colour per category, shared by the repayments chart and the schedule so
// an expense's name/amount always matches its category's bar colour.
const CATEGORY_COLORS: Record<string, string> = {
  Groceries: "#84cc16", // lime
  Lunch: "#f59e0b", // amber
  "Social Life": "#ec4899", // pink
  Shopping: "#10b981", // green
  Sports: "#f43f5e", // rose
  Transport: "#8b5cf6", // violet
  Mobile: "#06b6d4", // cyan
  Barber: "#eab308", // yellow
  Other: "#6366f1", // indigo
  Travel: "#14b8a6", // teal
  Savings: "#0ea5e9", // sky
};
// Fallback palette for any custom category not in the fixed map above.
const CAT_PALETTE = ["#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#c084fc", "#fb7185", "#2dd4bf", "#fb923c", "#f472b6", "#a3e635"];
export function catColor(cat: string): string {
  if (!cat) return "#9ca3af";
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return CAT_PALETTE[h % CAT_PALETTE.length];
}

interface Split {
  date: string | null;
  amount: number | null;
}

export function splitsOf(r: Repayment): Split[] {
  return [
    { date: r.repayment_1_date, amount: r.repayment_1_amount },
    { date: r.repayment_2_date, amount: r.repayment_2_amount },
    { date: r.repayment_3_date, amount: r.repayment_3_amount },
  ];
}

const monthOf = (iso: string) => iso.slice(0, 7);

/**
 * Sum of split amounts still to be paid — i.e. splits that are not yet past.
 * A split counts as "left to pay" when it has an amount and its date is today
 * or later (or has no date scheduled). Mirrors the greyed-out "past" styling
 * in the repayment table. Returned as a positive number.
 */
export function leftToPay(r: Repayment): number {
  const today = new Date().toISOString().slice(0, 10);
  return splitsOf(r).reduce((sum, s) => {
    if (s.amount == null) return sum;
    const isPast = s.date && s.date.slice(0, 10) < today;
    return isPast ? sum : sum + Math.abs(s.amount);
  }, 0);
}

/**
 * Months to display in the repayments view.
 *
 * If today is within the first 7 days of the month: current month + next 2.
 * Otherwise: next month + 2 months after that (3 months total from next month).
 */
export function visibleRepaymentMonths(): string[] {
  const today = new Date();
  const day = today.getDate();
  const y = today.getFullYear();
  const m = today.getMonth();

  const startOffset = day <= 7 ? 0 : 1;
  const months: string[] = [];
  for (let i = startOffset; i < startOffset + 3; i++) {
    const d = new Date(y, m + i, 1);
    months.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return months;
}

// Category × month matrix — amounts shown as positive numbers.
export function pivot(repayments: Repayment[], months: string[]) {
  const monthSet = new Set(months);
  const byCategory = new Map<string, Record<string, number>>();

  for (const r of repayments) {
    const cat = r.category || "Uncategorized";
    const row = byCategory.get(cat) ?? {};
    for (const s of splitsOf(r)) {
      if (!s.date || !s.amount) continue;
      const mo = monthOf(s.date);
      if (!monthSet.has(mo)) continue;
      row[mo] = (row[mo] ?? 0) + Math.abs(s.amount);
    }
    byCategory.set(cat, row);
  }

  const rows = [...byCategory.entries()]
    .map(([category, values]) => ({ category, values }))
    .filter((r) => Object.keys(r.values).length > 0)
    .sort((a, b) => a.category.localeCompare(b.category));

  return { months, rows };
}

export interface DailyPoint {
  date: string;
  total: number;
  byCategory: Record<string, number>;
}

// Repayments grouped by day and category — amounts as positive numbers.
export function dailyUpcoming(repayments: Repayment[], visibleMonths: string[]): DailyPoint[] {
  const monthSet = new Set(visibleMonths);
  const byDay = new Map<string, Record<string, number>>();
  for (const r of repayments) {
    const cat = r.category || "Other";
    for (const s of splitsOf(r)) {
      if (!s.date || !s.amount) continue;
      const day = s.date.slice(0, 10);
      if (!monthSet.has(day.slice(0, 7))) continue;
      const dayMap = byDay.get(day) ?? {};
      dayMap[cat] = (dayMap[cat] ?? 0) + Math.abs(s.amount);
      byDay.set(day, dayMap);
    }
  }
  return [...byDay.entries()]
    .map(([date, byCategory]) => ({
      date,
      total: Math.round(Object.values(byCategory).reduce((s, v) => s + v, 0) * 100) / 100,
      byCategory,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface DueItem {
  id: string;
  description: string;
  category: string;
  amount: number; // positive
}

// Individual repayment splits due on a specific day, largest amount first.
export function repaymentsOnDate(repayments: Repayment[], date: string): DueItem[] {
  const items: DueItem[] = [];
  for (const r of repayments) {
    for (const s of splitsOf(r)) {
      if (!s.date || !s.amount) continue;
      if (s.date.slice(0, 10) !== date) continue;
      items.push({
        id: r.id,
        description: r.description,
        category: r.category || "Other",
        amount: Math.abs(s.amount),
      });
    }
  }
  return items.sort((a, b) => b.amount - a.amount);
}

// All unique categories present in the visible window, sorted.
export function dailyUpcomingCats(repayments: Repayment[], visibleMonths: string[]): string[] {
  const cats = new Set<string>();
  const monthSet = new Set(visibleMonths);
  for (const r of repayments) {
    for (const s of splitsOf(r)) {
      if (!s.date || !s.amount) continue;
      if (!monthSet.has(s.date.slice(0, 7))) continue;
      cats.add(r.category || "Other");
    }
  }
  return [...cats].sort();
}

// Filter out internal Flex entries and rows with no splits in the visible window.
export function filterActiveRepayments(
  repayments: Repayment[],
  visibleMonths: string[],
) {
  const monthSet = new Set(visibleMonths);
  return repayments.filter((r) => {
    if (r.description === "Flex") return false;
    return splitsOf(r).some((s) => s.date && monthSet.has(s.date.slice(0, 7)));
  });
}
