import type { RentData } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import { rentMonthCost } from "../../lib/pots";
import { HeroBarChart, HeroChartHeader } from "../HeroCharts";

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

/**
 * The Rent header's minimal chart: what each month costs you, rent included —
 * trued up for pots, so it adds up to the headline beside it.
 */
export function BillsHeroChart({ data, months, className }: { data: RentData; months: string[]; className?: string }) {
  const monthTotal = (m: string) => rentMonthCost(data, m);
  // The figure beside the chart is already the average, so name this month instead.
  const thisMonth = months.includes(currentMonth) ? monthTotal(currentMonth) : 0;
  return (
    <div>
      <HeroChartHeader
        title="Rent & bills each month"
        note={thisMonth > 0 ? `${gbp0(thisMonth)} this month` : undefined}
      />
      <HeroBarChart
        className={className}
        valueLabel="Rent & bills"
        format={gbp0}
        data={months.map((m) => {
          const d = new Date(`${m}-01`);
          return {
            label: d.toLocaleString("en-GB", { month: "long" }),
            title: d.toLocaleString("en-GB", { month: "long", year: "numeric" }),
            value: monthTotal(m),
            // Months still to come are planned, not spent — the fainter bar says so.
            faded: m > currentMonth,
          };
        })}
      />
    </div>
  );
}
