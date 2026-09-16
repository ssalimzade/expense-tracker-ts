import { useEffect, useMemo, useState } from "react";
import { usePlanner, useSavePlanner } from "../../hooks/usePlanner";
import { useAllBudgets, useSaveBudget } from "../../hooks/useBudget";
import { toMonthKey, formatMonthLabel, gbp0 as gbp } from "../../lib/format";
import { MAIN_CATEGORIES } from "../../types/categories";
import type { BudgetMap } from "../../types/budget";
import { QueryState } from "../common";
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
  // Reported by the calendar, which knows the bank holidays.
  const [workingDays, setWorkingDays] = useState(0);
  const [bankHolidays, setBankHolidays] = useState(0);

  // Hydrate local state when the selected month's plan loads. Budgets default to
  // empty (£0) — no seeding from other months.
  const serverPlan = plannerQuery.data;
  useEffect(() => {
    if (!serverPlan) return;
    setDraft(serverPlan.budgets);
    setDaysOff(new Set(serverPlan.days_off));
  }, [serverPlan]);

  const allBudgets = allBudgetsQuery.data ?? {};
  const lastMonthKey = prevMonthKey(planMonth);
  const lastMonth = allBudgets[lastMonthKey] ?? {};
  const lastMonthName = new Date(
    Number(lastMonthKey.slice(0, 4)),
    Number(lastMonthKey.slice(5, 7)) - 1,
    1,
  ).toLocaleString("en-GB", { month: "long" });
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

  const sum = (m: BudgetMap) => MAIN_CATEGORIES.reduce((t, c) => t + (m[c] ?? 0), 0);
  const total = sum(draft);
  const lastTotal = sum(lastMonth);
  const avgTotal = sum(avg2026);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Month strip */}
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        {monthOptions.map((m) => {
          const [y, mm] = m.split("-").map(Number);
          const d = new Date(y, mm - 1, 1);
          const active = m === planMonth;
          return (
            <button
              key={m}
              onClick={() => setPlanMonth(m)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-left transition ${
                active
                  ? "bg-gray-900 text-white shadow-md dark:bg-white dark:text-gray-900"
                  : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
              }`}
            >
              <span className="block text-sm font-bold">{d.toLocaleString("en-GB", { month: "short" })}</span>
              <span className={`block text-[11px] tabular-nums ${active ? "opacity-60" : "text-gray-400"}`}>{y}</span>
            </button>
          );
        })}
      </div>

      <QueryState isLoading={plannerQuery.isLoading} error={plannerQuery.error}>
        <div className="space-y-5">
          {/* Hero */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-rose-500 via-fuchsia-600 to-purple-700 text-white shadow-lg shadow-fuchsia-500/20 dark:from-rose-700 dark:via-fuchsia-800 dark:to-purple-900 dark:shadow-none">
            {/* A faint month grid */}
            <svg viewBox="0 0 280 200" className="pointer-events-none absolute -right-4 top-1/2 h-64 -translate-y-1/2 text-white/10 max-sm:opacity-50" aria-hidden>
              {Array.from({ length: 35 }, (_, i) => (
                <rect key={i} x={(i % 7) * 40 + 4} y={Math.floor(i / 7) * 40 + 4} width="32" height="32" rx="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
              ))}
            </svg>
            <div className="relative p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
                  Planning {formatMonthLabel(planMonth)}
                </span>
                {savePlanner.isPending && (
                  <span className="flex items-center gap-1.5 text-xs text-white/80">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Saving…
                  </span>
                )}
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Planned spending</p>
              <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{gbp(total)}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <DeltaChip label={`vs ${lastMonthName}`} diff={total - lastTotal} show={lastTotal > 0} />
                <DeltaChip label="vs 2026 average" diff={total - avgTotal} show={avgTotal > 0} />
              </div>

              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div className="grid grid-cols-3 gap-5">
                  <HeroStat label="Working days" value={String(workingDays)} />
                  <HeroStat label="Days off" value={String(daysOff.size)} />
                  <HeroStat label="Bank hols" value={String(bankHolidays)} />
                </div>
                <button
                  onClick={moveToBudget}
                  disabled={saveBudget.isPending}
                  className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-sm font-bold text-fuchsia-700 shadow-lg transition hover:scale-[1.02] disabled:opacity-60 max-sm:w-full max-sm:justify-center"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
                  </svg>
                  {saveBudget.isPending ? "Moving…" : "Move to Budget"}
                </button>
              </div>
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <PlannerBudgetTable
              draft={draft}
              lastMonth={lastMonth}
              lastMonthName={lastMonthName}
              avg2026={avg2026}
              onChange={setCategory}
              onCommit={commitCategory}
            />
            <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
              <PlannerCalendar
                month={planMonth}
                daysOff={daysOff}
                onToggleDay={toggleDay}
                onStats={(s) => {
                  if (s.workingDays !== workingDays) setWorkingDays(s.workingDays);
                  if (s.bankHolidays !== bankHolidays) setBankHolidays(s.bankHolidays);
                }}
              />
              <RepaymentHints month={planMonth} onApply={applyHint} />
            </aside>
          </div>
        </div>
      </QueryState>
    </div>
  );
}

function DeltaChip({ label, diff, show }: { label: string; diff: number; show: boolean }) {
  if (!show) return null;
  const same = Math.round(diff) === 0;
  return (
    <span className="rounded-full bg-white/15 px-2.5 py-0.5">
      {same ? "Same" : `${diff > 0 ? "▲" : "▼"} ${gbp(Math.abs(diff))}`} {label}
    </span>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className="mt-0.5 text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}
