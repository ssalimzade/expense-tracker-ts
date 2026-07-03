import type { Transaction } from "../types/transaction";
import { MAIN_CATEGORIES, RENT_UTILITY_CATEGORY } from "../types/categories";

// Categories that must never count toward dashboard spend / budgeting.
// Rent & Utilities is tracked separately in the Rent tab.
function isExcluded(category: string): boolean {
  return category === "Uncategorized" || category === RENT_UTILITY_CATEGORY;
}

// Net all categorized amounts per category (refunds offset spending), then report
// the positive spending total. Matches old project: groupby(category).sum().abs()
// One-time transactions are included when they carry a real category.
export function spendByCategory(transactions: Transaction[]): Record<string, number> {
  const rawSums: Record<string, number> = {};
  for (const t of transactions) {
    if (isExcluded(t.category)) continue;
    rawSums[t.category] = (rawSums[t.category] ?? 0) + t.amount;
  }
  const totals: Record<string, number> = {};
  for (const cat of MAIN_CATEGORIES) {
    const s = rawSums[cat] ?? 0;
    totals[cat] = s < 0 ? -s : 0;
  }
  return totals;
}

// Total across all categories: net refunds against spending, exclude Uncategorized
// and Rent & Utilities.
export function totalSpend(transactions: Transaction[]): number {
  let rawSum = 0;
  for (const t of transactions) {
    if (isExcluded(t.category)) continue;
    rawSum += t.amount;
  }
  return rawSum < 0 ? -rawSum : 0;
}

export interface DailySpendPoint {
  date: string;
  day: number;
  cumulative: number | null;
  pace: number;
  projection: number | null;
}

/**
 * Full-month daily series: actual cumulative spend (stops at "today" for the
 * current month) plus a linear budget-pace target line for comparison.
 *
 * Refunds on a given day reduce that day's cumulative total. One-time
 * transactions with a real category are included (matching old-project behavior).
 *
 * For the current month, also computes a smart projection that trims outlier
 * days before extrapolating forward. Outlier detection: any day with spend >
 * 3× the median non-zero day is excluded from the rate calculation. The
 * projection is suppressed until day 4 when there is enough data for the
 * trimming to be meaningful.
 */
export function dailySpendSeries(
  transactions: Transaction[],
  month: string,
  totalBudget: number,
): DailySpendPoint[] {
  // Raw net per day: negative = net spending, positive = net refund
  const byDay = new Map<string, number>();
  for (const t of transactions) {
    if (isExcluded(t.category)) continue;
    const key = t.created.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + t.amount);
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const isCurrentMonth = month === nowKey;
  const todayDay = now.getDate();

  let projectionRate: number | null = null;
  let projectionStartCumulative: number | null = null;

  if (isCurrentMonth && todayDay > 3) {
    let runningNet = 0;
    // Per-day spend amounts (positive = net spend that day, 0 if refund day)
    const dailyAmounts: number[] = [];
    for (let d = 1; d <= todayDay; d++) {
      const netDay = byDay.get(`${month}-${String(d).padStart(2, "0")}`) ?? 0;
      runningNet += netDay;
      dailyAmounts.push(Math.max(0, -netDay));
    }
    projectionStartCumulative = Math.max(0, -runningNet);

    const nonZero = dailyAmounts.filter((a) => a > 0);
    if (nonZero.length > 0) {
      const sorted = [...nonZero].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const threshold = median * 3;
      const normalSpend = dailyAmounts.reduce((s, a) => s + (a <= threshold ? a : 0), 0);
      projectionRate = normalSpend / todayDay;
    }
  }

  let running = 0;
  const out: DailySpendPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    running += byDay.get(date) ?? 0;
    const inFuture = isCurrentMonth && d > todayDay;
    const isToday = isCurrentMonth && d === todayDay;

    let projection: number | null = null;
    if (projectionRate !== null && projectionStartCumulative !== null) {
      if (isToday) {
        projection = Math.round(projectionStartCumulative * 100) / 100;
      } else if (inFuture) {
        projection = Math.round(
          (projectionStartCumulative + projectionRate * (d - todayDay)) * 100,
        ) / 100;
      }
    }

    // running is negative (net spending), flip to positive for display
    const spent = Math.max(0, -running);
    out.push({
      date,
      day: d,
      cumulative: inFuture ? null : Math.round(spent * 100) / 100,
      pace: totalBudget > 0 ? Math.round((totalBudget * d / daysInMonth) * 100) / 100 : 0,
      projection,
    });
  }
  return out;
}
