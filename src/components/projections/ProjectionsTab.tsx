import { useState } from "react";
import { useProjections, useSaveProjectionRow } from "../../hooks/useProjections";
import { useSavings, useSaveSavingsRow } from "../../hooks/useSavings";
import { useRemuneration } from "../../hooks/useRemuneration";
import { useRent } from "../../hooks/useRent";
import { useAllPlanner } from "../../hooks/usePlanner";
import { QueryState } from "../common";
import Hero, { HeroChip } from "../Hero";
import YearSwitch from "../YearSwitch";
import { MAIN_CATEGORIES } from "../../types/categories";
import { deriveView } from "../../types/projections";
import type { ProjectionRow, ProjectionView, ProjectionInput, AllocationField } from "../../types/projections";
import type { SavingsRow } from "../../types/savings";
import { gbp0 } from "../../lib/format";
import { currentNetMonthly } from "../../lib/remuneration";
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
        const currentNetPm = currentNetMonthly(remuneration);

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

        const leftover = sum((r) => r.buffer);
        return (
          <div className="mx-auto max-w-7xl space-y-5">
            <YearSwitch years={years} year={year} onChange={setYear} />

            <Hero
              gradient="from-violet-600 via-purple-600 to-indigo-700 dark:from-violet-800 dark:via-purple-900 dark:to-indigo-950"
              badge={`${year} · ${elapsed.length} month${elapsed.length === 1 ? "" : "s"} so far`}
              label="Put aside this year"
              value={gbp0(totalAllocated)}
              decoration={
                <svg viewBox="0 0 240 160" className="pointer-events-none absolute -right-4 bottom-0 h-48 text-white/10" aria-hidden>
                  <path d="M0 150 L40 120 L80 128 L120 90 L160 96 L200 50 L240 20" fill="none" stroke="currentColor" strokeWidth="3" />
                  <path d="M0 150 L40 120 L80 128 L120 90 L160 96 L200 50 L240 20 L240 160 L0 160Z" fill="currentColor" opacity="0.4" />
                </svg>
              }
              under={
                <HeroChip>
                  {Math.round(avgRate * 100)}% of salary into home, savings & investments
                </HeroChip>
              }
              fields={[
                { label: "Avg salary", value: gbp0(avgSalary), sub: "a month, before bonus" },
                { label: "Avg costs", value: gbp0(avgCosts), sub: `${Math.round((avgCosts / (avgSalary || 1)) * 100)}% of salary` },
                { label: "Buffer so far", value: gbp0(leftover), sub: "left after everything", warn: leftover < 0 },
              ]}
            />

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
