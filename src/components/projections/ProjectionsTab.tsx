import { useState } from "react";
import { useProjections, useSaveProjectionRow } from "../../hooks/useProjections";
import { useSavings, useSaveSavingsRow } from "../../hooks/useSavings";
import { useRemuneration } from "../../hooks/useRemuneration";
import { useRent } from "../../hooks/useRent";
import { useAllPlanner } from "../../hooks/usePlanner";
import { QueryState } from "../common";
import { MAIN_CATEGORIES } from "../../types/categories";
import { deriveView } from "../../types/projections";
import type { ProjectionRow, ProjectionView, ProjectionInput, AllocationField } from "../../types/projections";
import type { SavingsRow } from "../../types/savings";
import { gbp0 } from "../../lib/format";
import ProjectionsTable from "./ProjectionsTable";
import { AllocationChart, SalaryVsCostChart } from "./ProjectionsCharts";

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const monthsOfYear = (year: string) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

// Only link the Monthly row to the Planner once the plan is substantially filled
// in — at least this fraction of the main categories must have a budget set.
const PLANNER_FILL_THRESHOLD = 0.8;

export default function ProjectionsTab() {
  const projQuery = useProjections();
  const savingsQuery = useSavings();
  const remQuery = useRemuneration();
  const rentQuery = useRent();
  const plannerQuery = useAllPlanner();
  const saveProj = useSaveProjectionRow();
  const saveSavings = useSaveSavingsRow();

  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);

  const loading =
    projQuery.isLoading || savingsQuery.isLoading || remQuery.isLoading || rentQuery.isLoading || plannerQuery.isLoading;
  const error = projQuery.error || savingsQuery.error || remQuery.error || rentQuery.error || plannerQuery.error;

  return (
    <QueryState isLoading={loading} error={error}>
      {(() => {
        const projections = projQuery.data ?? [];
        const savings = savingsQuery.data ?? [];
        const remuneration = remQuery.data ?? [];
        const rent = rentQuery.data ?? { items: [], months: {} };
        const planner = plannerQuery.data ?? {};

        // Current monthly salary from the Salary tab (linked, but editable per month).
        const currentNetPm = (remuneration.find((r) => r.current) ?? remuneration[remuneration.length - 1])?.net_pm ?? 0;

        const projByMonth = new Map(projections.map((p) => [p.month, p]));
        const savByMonth = new Map(savings.map((s) => [s.start_date.slice(0, 7), s]));
        const rentTotal = (month: string) => {
          const entry = rent.months[month];
          if (!entry) return 0;
          return rent.items.reduce((sum, it) => sum + (entry[it.key]?.amount ?? 0), 0);
        };
        // Planner budget total for a month, but only once the plan is mostly filled
        // in (≥ PLANNER_FILL_THRESHOLD of categories budgeted); otherwise 0 so the
        // Monthly row falls back to its own stored value.
        const plannerMonthlyTotal = (month: string) => {
          const budgets = planner[month]?.budgets;
          if (!budgets) return 0;
          const filled = MAIN_CATEGORIES.filter((c) => (budgets[c] ?? 0) > 0).length;
          if (filled / MAIN_CATEGORIES.length < PLANNER_FILL_THRESHOLD) return 0;
          return MAIN_CATEGORIES.reduce((sum, c) => sum + (budgets[c] ?? 0), 0);
        };

        // Year tabs come from the projection/rent data only (not Savings, which
        // has older years that aren't relevant to the plan).
        const years = [...new Set([
          ...projections.map((p) => p.month.slice(0, 4)),
          ...Object.keys(rent.months).map((m) => m.slice(0, 4)),
          currentYear,
        ])].sort();

        const rows: ProjectionView[] = monthsOfYear(year).map((month) => {
          const p = projByMonth.get(month);
          const s = savByMonth.get(month);
          // Rent pulls from the Rent tab, but a stored housing_costs override wins.
          const rent = p && p.housing_costs > 0 ? p.housing_costs : rentTotal(month);
          // Monthly pulls from the Planner total, but a stored monthly_costs override wins.
          const monthly_costs = p && p.monthly_costs > 0 ? p.monthly_costs : plannerMonthlyTotal(month);
          return deriveView({
            month,
            salary: p && p.salary > 0 ? p.salary : currentNetPm,
            bonus: p?.bonus ?? 0,
            monthly_costs,
            other_pl: p?.other_pl ?? 0,
            notes: p?.notes ?? "",
            rent,
            home_contributions: s?.home_contributions ?? 0,
            savings: s?.savings ?? 0,
            investments: s?.investments ?? 0,
          });
        });

        // ---- handlers ----------------------------------------------------
        const saveProjectionField = (month: string, field: ProjectionInput | "notes", value: number | string) => {
          const p = projByMonth.get(month);
          const payload: ProjectionRow = {
            month,
            // keep salary / housing_costs unset (0) when not explicitly edited so
            // they stay linked to the Salary / Rent tabs
            salary: field === "salary" ? (value as number) : p?.salary ?? 0,
            bonus: field === "bonus" ? (value as number) : p?.bonus ?? 0,
            monthly_costs: field === "monthly_costs" ? (value as number) : p?.monthly_costs ?? 0,
            housing_costs: field === "housing_costs" ? (value as number) : p?.housing_costs ?? 0,
            other_pl: field === "other_pl" ? (value as number) : p?.other_pl ?? 0,
            notes: field === "notes" ? (value as string) : p?.notes ?? "",
            home_contributions: 0,
            savings: 0,
            investments: 0,
          };
          saveProj.mutate(payload);
        };

        const onAllocation = (month: string, field: AllocationField, value: number) => {
          const existing = savByMonth.get(month);
          if (existing) {
            if (existing[field] === value) return;
            saveSavings.mutate({ ...existing, [field]: value });
          } else {
            const seed: Partial<SavingsRow> = {
              start_date: `${month}-01T00:00:00.000`,
              end_date: "",
              starting_balance: 0,
              home_contributions: 0,
              savings: 0,
              adjustments: 0,
              investments: 0,
              adjustment_notes: "",
              [field]: value,
            };
            saveSavings.mutate(seed);
          }
        };

        // ---- stats (elapsed months only) ---------------------------------
        const elapsed = rows.filter((r) => r.month <= currentMonth);
        const n = elapsed.length || 1;
        const sum = (pick: (r: ProjectionView) => number) => elapsed.reduce((acc, r) => acc + pick(r), 0);
        const avgSalary = sum((r) => r.salary) / n; // base salary only, excludes bonus
        const avgCosts = sum((r) => r.totalCosts) / n;
        const totalAllocated = sum((r) => r.home_contributions + r.savings + r.investments);
        const avgRate = avgSalary ? totalAllocated / sum((r) => r.salary) : 0;

        const stats = [
          { label: "Avg Salary", value: gbp0(avgSalary), sub: `${elapsed.length} mo`, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/60 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900" },
          { label: "Avg Costs", value: gbp0(avgCosts), sub: `${Math.round((avgCosts / (avgSalary || 1)) * 100)}% of salary`, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50/60 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900" },
          { label: "Allocated (Home/Save/Invest)", value: gbp0(totalAllocated), sub: `${Math.round(avgRate * 100)}% savings rate`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900" },
        ];

        return (
          <div className="space-y-4">
            {/* Year tabs */}
            <div className="flex gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 w-fit">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => setYear(y)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                    y === year
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>

            {/* Summary cards */}
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className={`rounded-2xl border px-5 py-4 text-center ${s.bg}`}>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{s.label}</p>
                  <p className={`mt-1.5 text-2xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <AllocationChart rows={rows} />
              <SalaryVsCostChart rows={rows} />
            </div>

            <ProjectionsTable
              rows={rows}
              onProjectionField={(m, f, v) => saveProjectionField(m, f, v)}
              onNotes={(m, v) => saveProjectionField(m, "notes", v)}
              onAllocation={onAllocation}
            />
          </div>
        );
      })()}
    </QueryState>
  );
}
