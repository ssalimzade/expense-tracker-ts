import type { ReactNode } from "react";
import type { RemunerationRow } from "../../types/remuneration";
import { resolvePay } from "../../lib/remuneration";
import { HeroChartHeader, HeroLineChart } from "../HeroCharts";

const money = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

/** The Salary header's minimal pay line: take-home a month, the figure above it. */
export function PayHeroChart({
  rows,
  note,
  className = "h-32",
}: {
  rows: RemunerationRow[];
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div>
      <HeroChartHeader title="Pay over time" note={note} />
      <HeroLineChart
        className={className}
        data={rows.map((r) => ({
          start: r.period.split(" - ")[0].trim(),
          full: r.period,
          net: Math.round(resolvePay(r).net_pm),
        }))}
        labelKey="start"
        tipTitleKey="full"
        format={money}
        series={[{ key: "net", label: "Take-home a month", kind: "area" }]}
      />
    </div>
  );
}
