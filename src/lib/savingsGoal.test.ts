import { describe, expect, it } from "vitest";
import type { SavingsRow } from "../types/savings";
import { addMonths, averageSaved, balanceNow, firstSavingMonth, goalOutlook, monthlyFor, monthsBetween, monthsToGoal, reachMonth, spanLabel } from "./savingsGoal";

const row = (month: string, savings: number, ending: number): SavingsRow => ({
  start_date: `${month}-01`,
  end_date: `${month}-28`,
  starting_balance: 0,
  home_contributions: 0,
  savings,
  adjustments: 0,
  investments: 0,
  ending_balance: ending,
  adjustment_notes: "",
});

describe("month arithmetic", () => {
  it("adds across a year end", () => {
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });

  it("counts months between", () => {
    expect(monthsBetween("2026-11", "2027-12")).toBe(13);
    expect(monthsBetween("2026-11", "2026-11")).toBe(0);
    expect(monthsBetween("2026-11", "2026-09")).toBe(-2);
  });
});

describe("monthsToGoal", () => {
  it("rounds a part month up", () => {
    expect(monthsToGoal(17_600, 1_500)).toBe(12);
    expect(monthsToGoal(18_000, 1_500)).toBe(12);
  });

  it("is 0 once the goal is reached", () => {
    expect(monthsToGoal(0, 500)).toBe(0);
    expect(monthsToGoal(-200, 500)).toBe(0);
  });

  it("never gets there on nothing a month", () => {
    expect(monthsToGoal(1_000, 0)).toBe(Infinity);
  });

  it("doesn't tip into an extra month on float error", () => {
    expect(monthsToGoal(1_000, 1_000 / 3)).toBe(3);
  });
});

describe("monthlyFor", () => {
  it("rounds up to the pound so the goal is met in time", () => {
    expect(monthlyFor(17_600, 13)).toBe(1_354);
    expect(monthsToGoal(17_600, monthlyFor(17_600, 13))).toBe(13);
  });

  it("asks for everything at once when there's no time left", () => {
    expect(monthlyFor(5_000, 0)).toBe(5_000);
  });
});

describe("balanceNow", () => {
  const rows = [row("2026-09", 1_000, 30_000), row("2026-10", 1_000, 31_000), row("2026-11", 1_000, 32_000), row("2026-12", 1_000, 33_000)];

  it("is this month's ending balance", () => {
    expect(balanceNow(rows, "2026-11")).toBe(32_000);
  });

  it("falls back to the latest month before it", () => {
    expect(balanceNow(rows.slice(0, 2), "2026-11")).toBe(31_000);
  });

  it("is 0 with no months yet", () => {
    expect(balanceNow([], "2026-11")).toBe(0);
  });
});

describe("averageSaved", () => {
  it("averages up to this month, ignoring planned months", () => {
    const rows = [row("2026-10", 1_000, 0), row("2026-11", 2_000, 0), row("2026-12", 9_000, 0)];
    expect(averageSaved(rows, "2026-11")).toBe(1_500);
  });

  it("only looks back over the window", () => {
    const rows = [row("2025-10", 9_000, 0), row("2026-11", 1_000, 0)];
    expect(averageSaved(rows, "2026-11", 12)).toBe(1_000);
  });

  it("is null with nothing to average", () => {
    expect(averageSaved([], "2026-11")).toBeNull();
  });
});

describe("firstSavingMonth", () => {
  it("is next month unless the start is later", () => {
    expect(firstSavingMonth({ start: null }, "2026-11")).toBe("2026-12");
    expect(firstSavingMonth({ start: "2027-03" }, "2026-11")).toBe("2027-03");
    expect(firstSavingMonth({ start: "2026-05" }, "2026-11")).toBe("2026-12");
  });

  it("reaches the goal in the last month of saving", () => {
    expect(reachMonth("2026-12", 1)).toBe("2026-12");
    expect(reachMonth("2026-12", 14)).toBe("2028-01");
  });
});

describe("spanLabel", () => {
  it("reads naturally", () => {
    expect(spanLabel(1)).toBe("1 month");
    expect(spanLabel(8)).toBe("8 months");
    expect(spanLabel(12)).toBe("1 year");
    expect(spanLabel(27)).toBe("2 years 3 months");
  });
});

describe("goalOutlook", () => {
  const goal = { id: "g", name: "Deposit", target: 21_600, start: null, deadline: null, saved: null, monthly: 800 };

  it("times the goal at its plan", () => {
    expect(goalOutlook(goal, 10_681, "2026-11")).toMatchObject({ remaining: 10_919, plan: 800, months: 14, needed: null });
  });

  it("works out what a deadline needs", () => {
    const o = goalOutlook({ ...goal, monthly: null, deadline: "2027-12" }, 10_681, "2026-11");
    expect(o).toMatchObject({ monthsLeft: 13, needed: 840, plan: null, months: null });
  });

  it("counts from a later start", () => {
    const o = goalOutlook({ ...goal, start: "2027-01", deadline: "2027-12" }, 10_681, "2026-11");
    expect(o).toMatchObject({ first: "2027-01", monthsLeft: 12, needed: 910, months: 14, deadlineState: "ok" });
    expect(reachMonth(o.first, o.months!)).toBe("2028-02");
  });

  it("flags a deadline before the start, this month, or gone", () => {
    expect(goalOutlook({ ...goal, start: "2027-06", deadline: "2027-03" }, 0, "2026-11").deadlineState).toBe("beforeStart");
    expect(goalOutlook({ ...goal, deadline: "2026-11" }, 0, "2026-11").deadlineState).toBe("now");
    expect(goalOutlook({ ...goal, deadline: "2026-10" }, 0, "2026-11").deadlineState).toBe("passed");
  });

  it("treats a £0 plan as none and caps progress at 100%", () => {
    expect(goalOutlook({ ...goal, monthly: 0 }, 30_000, "2026-11")).toMatchObject({ remaining: 0, pct: 100, plan: null });
  });
});
