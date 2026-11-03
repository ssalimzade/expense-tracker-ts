import type { SavingsGoal, SavingsRow } from "../types/savings";
import { toMonthKey } from "./format";

/** "YYYY-MM" `n` months after `key`. */
export const addMonths = (key: string, n: number) => {
  const [y, m] = key.split("-").map(Number);
  return toMonthKey(new Date(y, m - 1 + n, 1));
};

/** Whole months from `from` to `to` ("YYYY-MM"); negative when `to` is earlier. */
export const monthsBetween = (from: string, to: string) => {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
};

/**
 * Months of putting by `monthly` it takes to cover `remaining`: 0 when nothing
 * is left, Infinity when the amount never gets there.
 */
export const monthsToGoal = (remaining: number, monthly: number) => {
  if (remaining <= 0) return 0;
  if (!(monthly > 0)) return Infinity;
  // The epsilon keeps 1,000 / (1,000 / 3) at 3 rather than 4.
  return Math.ceil(remaining / monthly - 1e-9);
};

/** Monthly amount, rounded up to the pound, that covers `remaining` in `months`. */
export const monthlyFor = (remaining: number, months: number) => {
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / Math.max(1, months));
};

/**
 * The savings balance as it stands: this month's ending balance — the figure
 * on the hero — else the latest month before it. New money starts next month.
 */
export const balanceNow = (rows: SavingsRow[], current: string) => {
  const past = rows.filter((r) => r.start_date.slice(0, 7) <= current);
  return past.length ? past[past.length - 1].ending_balance ?? 0 : 0;
};

/** Average monthly savings over the last `window` months up to this one, or null with none. */
export const averageSaved = (rows: SavingsRow[], current: string, window = 12) => {
  const from = addMonths(current, -(window - 1));
  const recent = rows.filter((r) => {
    const k = r.start_date.slice(0, 7);
    return k >= from && k <= current;
  });
  if (!recent.length) return null;
  return recent.reduce((s, r) => s + (r.savings ?? 0), 0) / recent.length;
};

/** Past this a reach month isn't worth naming — it'd be over 100 years away. */
export const MAX_MONTHS = 1_200;

/**
 * First month new saving goes in: the goal's start, or next month if that's
 * later — this month is already in the balance, and a start that has come
 * round just means saving is under way.
 */
export const firstSavingMonth = (goal: Pick<SavingsGoal, "start">, current: string) => {
  const next = addMonths(current, 1);
  return goal.start && goal.start > next ? goal.start : next;
};

/** The month a goal is reached after `months` of saving, the first in `first`. */
export const reachMonth = (first: string, months: number) => addMonths(first, Math.max(0, months - 1));

export type DeadlineState = "ok" | "passed" | "now" | "beforeStart";

/**
 * Where a goal stands with `saved` put by: what's left, how far along, when
 * saving starts, how many months of it fit before the deadline (the first and
 * the deadline's own month both count) and what that needs a month, and — at
 * its saved plan — how many months it takes.
 */
export function goalOutlook(goal: SavingsGoal, saved: number, current: string) {
  const remaining = Math.max(0, goal.target - saved);
  const pct = Math.min(100, Math.max(0, (saved / goal.target) * 100));
  const first = firstSavingMonth(goal, current);
  const monthsLeft = goal.deadline ? monthsBetween(first, goal.deadline) + 1 : null;
  const deadlineState: DeadlineState | null = !goal.deadline
    ? null
    : goal.deadline < current
      ? "passed"
      : goal.deadline === current
        ? "now"
        : goal.deadline < first
          ? "beforeStart"
          : "ok";
  const needed = deadlineState === "ok" && remaining > 0 ? monthlyFor(remaining, monthsLeft!) : null;
  const plan = goal.monthly && goal.monthly > 0 ? goal.monthly : null;
  const months = plan !== null ? monthsToGoal(remaining, plan) : null;
  return { remaining, pct, first, monthsLeft, deadlineState, needed, plan, months };
}

/** "8 months", "1 year", "2 years 3 months". */
export const spanLabel = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (!y) return part(m, "month");
  return m ? `${part(y, "year")} ${part(m, "month")}` : part(y, "year");
};
