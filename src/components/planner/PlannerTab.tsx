import { useEffect, useMemo, useState } from "react";
import { usePlanner, useSavePlanner } from "../../hooks/usePlanner";
import { useAllBudgets, useSaveBudget } from "../../hooks/useBudget";
import { toMonthKey, formatMonthLabel } from "../../lib/format";
import { MAIN_CATEGORIES } from "../../types/categories";
import type { BudgetMap } from "../../types/budget";
import { QueryState } from "../common";
import Select from "../Select";
import PlannerCalendar from "./PlannerCalendar";
import RepaymentHints from "./RepaymentHints";
import PlannerBudgetTable from "./PlannerBudgetTable";

// Current month + the next 11 months — the planning horizon.
function plannableMonths(count = 12): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    months.push(toMonthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return months;
}

// "2026-07" → "2026-06"
function prevMonthKey(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return toMonthKey(new Date(y, m - 2, 1));
}

// Per-category average across all 2026 months that have a saved budget.
function average2026(all: Record<string, BudgetMap>): BudgetMap {
  const months = Object.keys(all).filter((m) => m.startsWith("2026-"));
  if (months.length === 0) return {};
  const avg: BudgetMap = {};
  for (const cat of MAIN_CATEGORIES) {
    const sum = months.reduce((s, m) => s + (all[m][cat] ?? 0), 0);
    avg[cat] = Math.round(sum / months.length);
  }
  return avg;
}

export default function PlannerTab() {
  const monthOptions = useMemo(() => plannableMonths(), []);
  // Default to next month — the typical thing you plan.
  const [planMonth, setPlanMonth] = useState<string>(monthOptions[1] ?? monthOptions[0]);

  const plannerQuery = usePlanner(planMonth);
  const savePlanner = useSavePlanner(planMonth);
  const allBudgetsQuery = useAllBudgets();
  const saveBudget = useSaveBudget(planMonth);

  const [draft, setDraft] = useState<BudgetMap>({});
  const [daysOff, setDaysOff] = useState<Set<number>>(new Set());

  // Hydrate local state when the selected month's plan loads. Budgets default to
  // empty (£0) — no seeding from other months.
  const serverPlan = plannerQuery.data;
  useEffect(() => {
    if (!serverPlan) return;
    setDraft(serverPlan.budgets);
    setDaysOff(new Set(serverPlan.days_off));
  }, [serverPlan]);

  const allBudgets = allBudgetsQuery.data ?? {};
  const lastMonth = allBudgets[prevMonthKey(planMonth)] ?? {};
  const avg2026 = useMemo(() => average2026(allBudgets), [allBudgets]);

  const persist = (nextDraft: BudgetMap, nextDaysOff: Set<number>) => {
    savePlanner.mutate({ daysOff: [...nextDaysOff], budgets: nextDraft });
  };

  const setCategory = (category: string, value: number) =>
    setDraft((prev) => ({ ...prev, [category]: value }));

  const commitCategory = (category: string, value: number) => {
    const next = { ...draft, [category]: value };
    setDraft(next);
    persist(next, daysOff);
  };

  // Compute the next set outside the state updater so it only fires one save
  // (React StrictMode double-invokes updater functions in dev).
  const toggleDay = (day: number) => {
    const next = new Set(daysOff);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    setDaysOff(next);
    persist(draft, next);
  };

  const applyHint = (category: string, amount: number) => {
    const next = { ...draft, [category]: Math.round((draft[category] ?? 0) + amount) };
    setDraft(next);
    persist(next, daysOff);
  };

  const moveToBudget = () => {
    if (
      !window.confirm(
        `Apply this plan to the ${formatMonthLabel(planMonth)} budget? This overwrites any existing budget for that month.`,
      )
    )
      return;
    saveBudget.mutate(draft);
  };

  return (
    <QueryState isLoading={plannerQuery.isLoading} error={plannerQuery.error}>
      <div className="space-y-4">
        {/* Header: month picker */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Planning
          </span>
          <Select
            value={planMonth}
            onChange={setPlanMonth}
            options={monthOptions.map((m) => ({ value: m, label: formatMonthLabel(m) }))}
            className="min-w-[140px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        </div>

        <PlannerCalendar month={planMonth} daysOff={daysOff} onToggleDay={toggleDay} />

        {/* Planned budget (left, wide) + repayment hints (right, narrow) */}
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PlannerBudgetTable
              draft={draft}
              lastMonth={lastMonth}
              lastMonthLabel={formatMonthLabel(prevMonthKey(planMonth))}
              avg2026={avg2026}
              planLabel={formatMonthLabel(planMonth)}
              onChange={setCategory}
              onCommit={commitCategory}
              saving={savePlanner.isPending}
              onMoveToBudget={moveToBudget}
              moving={saveBudget.isPending}
            />
          </div>
          <div className="lg:col-span-1">
            <RepaymentHints month={planMonth} onApply={applyHint} />
          </div>
        </div>
      </div>
    </QueryState>
  );
}
