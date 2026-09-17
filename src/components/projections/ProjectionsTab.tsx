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
import { HeroBarChart, HeroChartHeader } from "../HeroCharts";
import { TrendArt, IN_COLUMN } from "../HeroArt";

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
        // The year's cash flow, which is what this tab plans: everything that came
        // in, and the share of it the months have already spent.
        const totalIn = sum((r) => r.salary + r.bonus + r.other_pl);
        const totalCosts = sum((r) => r.totalCosts);
        const costRate = totalIn ? totalCosts / totalIn : 0;

        const leftover = sum((r) => r.buffer);

        // What's left of each month's income once costs are paid.
        const leftAfterCosts = rows.map((r) => r.salary + r.bonus + r.other_pl - r.totalCosts);
        const elapsedLeft = leftAfterCosts.filter((_, i) => rows[i].month <= currentMonth);
        const avgLeft = elapsedLeft.length ? elapsedLeft.reduce((a, b) => a + b, 0) / elapsedLeft.length : 0;
        const leftoverChart = (className: string) => (
          <div>
            <HeroChartHeader
              title="Left after costs"
              note={elapsedLeft.length ? `${avgLeft < 0 ? "−" : ""}${gbp0(Math.abs(avgLeft))} a month on average` : undefined}
            />
            <HeroBarChart
              className={className}
              valueLabel="Left over"
              format={(v) => `${v < 0 ? "−" : ""}${gbp0(Math.abs(v))}`}
              data={rows.map((r, i) => {
                const d = new Date(`${r.month}-01`);
                return {
                  label: d.toLocaleString("en-GB", { month: "long" }),
                  title: d.toLocaleString("en-GB", { month: "long", year: "numeric" }),
                  value: leftAfterCosts[i],
                  faded: r.month > currentMonth,
                };
              })}
            />
          </div>
        );
        return (
          <div className="mx-auto max-w-7xl space-y-5">
            <YearSwitch years={years} year={year} onChange={setYear} />

            <Hero
              gradient="from-[#4d7c8a] via-[#3b6070] to-[#243c47]"
              badge={`${year} · ${elapsed.length} month${elapsed.length === 1 ? "" : "s"} so far`}
              label="Money in this year"
              value={gbp0(totalIn)}
              decoration={
                <TrendArt className={IN_COLUMN} />
              }
              under={
                <HeroChip>
                  {gbp0(totalCosts)} of it spent — {Math.round(costRate * 100)}% of everything that came in
                </HeroChip>
              }
              aside={<div className="w-[26rem] xl:w-[32rem]">{leftoverChart("h-32")}</div>}
              asideFrom="lg"
              fields={[
                { label: "Average salary", value: gbp0(avgSalary), sub: "a month, before bonus" },
                { label: "Average costs", value: gbp0(avgCosts), sub: `${Math.round((avgCosts / (avgSalary || 1)) * 100)}% of salary` },
                { label: "Buffer so far", value: gbp0(leftover), sub: "left after everything", warn: leftover < 0 },
              ]}
            >
              <div className="mt-6 border-t border-dashed border-white/25 pt-5 lg:hidden">{leftoverChart("h-24")}</div>
            </Hero>

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
