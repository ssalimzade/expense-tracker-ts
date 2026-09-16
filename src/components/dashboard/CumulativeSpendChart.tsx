import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { Transaction } from "../../types/transaction";
import { dailySpendSeries } from "../../lib/spend";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, CHART, axisTick, gridStroke } from "../../lib/chart";
import ChartLegend from "../ChartLegend";
import { gbp0 as gbp } from "../../lib/format";
import { Card } from "../common";
import { useIsMobile } from "../../hooks/useIsMobile";

interface Props {
  transactions: Transaction[];
  month: string;
  totalBudget: number;
  /** Repayments committed on the 1st — where the budget pace line starts. */
  repaymentsBaseline?: number;
  /** "hero" draws in white for the gradient header, without its own card. */
  variant?: "card" | "hero";
}

// Series colours per surface: the indigo card, or white on the Budget header.
const THEMES = {
  card: {
    spent: "#4f46e5",
    fillOpacity: 0.2,
    pace: CHART.grey,
    projection: CHART.sand,
    tick: axisTick,
    grid: gridStroke,
    dotStroke: "#fff",
  },
  hero: {
    spent: "#ffffff",
    fillOpacity: 0.28,
    pace: "rgba(255,255,255,0.55)",
    projection: "#ecdcb6",
    tick: { fontSize: 11, fill: "rgba(255,255,255,0.65)" },
    grid: "rgba(255,255,255,0.12)",
    dotStroke: "#3b4fd0",
  },
} as const;

export default function CumulativeSpendChart({
  transactions,
  month,
  totalBudget,
  repaymentsBaseline = 0,
  variant = "card",
}: Props) {
  const theme = THEMES[variant];
  const hero = variant === "hero";
  const data = dailySpendSeries(transactions, month, totalBudget, repaymentsBaseline);

  // Latest actual cumulative + how it compares to the budget pace at that point.
  const lastActual = [...data].reverse().find((d) => d.cumulative !== null);
  const spent = lastActual?.cumulative ?? 0;
  const paceNow = lastActual?.pace ?? 0;
  const overPace = totalBudget > 0 && spent > paceNow;

  const isMobile = useIsMobile();
  // Sparse, evenly-spaced day ticks — fewer on mobile.
  const lastDay = data.length;
  const ticks = (isMobile ? [1, 10, 20, lastDay] : [1, 5, 10, 15, 20, 25, lastDay])
    .filter((d, i, a) => d <= lastDay && a.indexOf(d) === i);

  const monthShort = new Date(`${month}-01`).toLocaleString("en-GB", { month: "short" });
  const monthName = new Date(`${month}-01`).toLocaleString("en-GB", { month: "long", year: "numeric" });

  const legend = [
    { label: "Spent", color: theme.spent },
    ...(totalBudget > 0 ? [{ label: "Budget pace", color: theme.pace, dashed: true }] : []),
    { label: "Projected", color: theme.projection, dashed: true },
  ];

  const header = hero ? (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Pace</p>
        {totalBudget > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
            <span className={`h-1.5 w-1.5 rounded-full ${overPace ? "bg-rose-200" : "bg-emerald-300"}`} />
            {overPace ? "Ahead of budget pace" : "On track"}
          </span>
        )}
      </div>
      <ChartLegend items={legend} className="!text-white/70" />
    </div>
  ) : (
    <>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
            Cumulative Spent
          </h2>
          {totalBudget > 0 && (
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                overPace
                  ? "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                  : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${overPace ? "bg-red-500" : "bg-emerald-500"}`} />
              {overPace ? "Ahead of budget pace" : "On track with budget"}
            </span>
          )}
        </div>
        <div className="text-right">
          <span className="block text-2xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
            {gbp(spent)}
          </span>
          {totalBudget > 0 && (
            <span className="text-xs text-gray-400">of {gbp(totalBudget)} budget</span>
          )}
        </div>
      </div>
      <ChartLegend className="mb-2" items={legend} />
    </>
  );

  const gradientId = `spendGradient-${variant}`;
  const chart = (
    <>
      {header}
      <div className={hero ? "h-44 w-[26rem] xl:w-[34rem]" : "h-44 sm:h-56"}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.spent} stopOpacity={theme.fillOpacity} />
                <stop offset="95%" stopColor={theme.spent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={theme.grid} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, lastDay]}
              ticks={ticks}
              tick={theme.tick}
              tickFormatter={(d: number) => `${d} ${monthShort}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={theme.tick}
              width={52}
              tickCount={isMobile ? 3 : 5}
              tickFormatter={(v) => `£${v}`}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle()}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={hero ? { stroke: "rgba(255,255,255,0.35)" } : cursorStyle()}
              labelFormatter={(d) => `${d} ${monthName}`}
              formatter={(v: number, name) => {
                if (v == null) return ["—", ""];
                const labels: Record<string, string> = {
                  cumulative: "Spent",
                  pace: "Budget pace",
                  projection: "Projected",
                };
                return [gbp(v), labels[name as string] ?? name];
              }}
            />
            {totalBudget > 0 && (
              <Line
                type="monotone"
                dataKey="pace"
                stroke={theme.pace}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="projection"
              stroke={theme.projection}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke={theme.spent}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: theme.spent, stroke: theme.dotStroke, strokeWidth: 2 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );

  return hero ? <div className="flex h-full flex-col justify-end">{chart}</div> : <Card>{chart}</Card>;
}
