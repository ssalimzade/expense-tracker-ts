import type { RentData } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import { rentShare } from "../../lib/rent";
import { HeroBarChart, HeroChartHeader } from "../HeroCharts";

/** Rent dwarfs every bill, so the breakdown leaves it out and names it instead. */
const RENT_KEY = "flat";

/** The Rent header's minimal chart: bills (your share, rent left out) per month. */
export function BillsHeroChart({ data, months, className }: { data: RentData; months: string[]; className?: string }) {
  const bills = data.items.filter((it) => it.key !== RENT_KEY);
  const rentPerMonth = months.length ? months.reduce((s, m) => s + rentShare(data, m, RENT_KEY), 0) / months.length : 0;
  return (
    <div>
      <HeroChartHeader
        title="Bills each month"
        note={rentPerMonth > 0 ? `plus rent of about ${gbp0(rentPerMonth)} a month` : undefined}
      />
      <HeroBarChart
        className={className}
        valueLabel="Bills"
        format={gbp0}
        data={months.map((m) => {
          const d = new Date(`${m}-01`);
          return {
            label: d.toLocaleString("en-GB", { month: "long" }),
            title: d.toLocaleString("en-GB", { month: "long", year: "numeric" }),
            value: bills.reduce((s, it) => s + rentShare(data, m, it.key), 0),
          };
        })}
      />
    </div>
  );
}
