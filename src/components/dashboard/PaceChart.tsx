import type { Transaction } from "../../types/transaction";
import { dailySpendSeries } from "../../lib/spend";
import { gbp0 as gbp } from "../../lib/format";
import { HeroChartHeader, HeroLineChart } from "../HeroCharts";

/**
 * Month-to-date spend against the budget pace, drawn minimal for the Budget
 * header: the spent area, a dashed pace line and a fainter projection.
 */
export default function PaceChart({
  transactions,
  month,
  totalBudget,
  repaymentsBaseline = 0,
  className,
}: {
  transactions: Transaction[];
  month: string;
  totalBudget: number;
  /** Repayments committed on the 1st — where the budget pace line starts. */
  repaymentsBaseline?: number;
  className?: string;
}) {
  const series = dailySpendSeries(transactions, month, totalBudget, repaymentsBaseline);
  const lastActual = [...series].reverse().find((d) => d.cumulative !== null);
  const overPace = totalBudget > 0 && (lastActual?.cumulative ?? 0) > (lastActual?.pace ?? 0);

  const [y, m] = month.split("-").map(Number);
  const data = series.map((d) => {
    const date = new Date(y, m - 1, d.day);
    return {
      label: date.toLocaleDateString("en-GB", { day: "numeric", month: "long" }),
      title: date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
      spent: d.cumulative,
      pace: totalBudget > 0 ? d.pace : null,
      projected: d.projection,
    };
  });

  return (
    <div>
      <HeroChartHeader
        title="Pace"
        note={totalBudget > 0 ? (overPace ? "Ahead of budget pace" : "On track with budget") : undefined}
      />
      <HeroLineChart
        data={data}
        labelKey="label"
        tipTitleKey="title"
        series={[
          { key: "spent", label: "Spent", kind: "area" },
          { key: "pace", label: "Budget pace", kind: "dashed" },
          { key: "projected", label: "Projected", kind: "dashed" },
        ]}
        format={gbp}
        className={className}
      />
    </div>
  );
}
