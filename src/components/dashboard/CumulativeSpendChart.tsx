import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { Transaction } from "../../types/transaction";
import { dailySpendSeries } from "../../lib/spend";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { gbp0 as gbp } from "../../lib/format";
import { Card } from "../common";
import { useIsMobile } from "../../hooks/useIsMobile";

interface Props {
  transactions: Transaction[];
  month: string;
  totalBudget: number;
}

export default function CumulativeSpendChart({ transactions, month, totalBudget }: Props) {
  const data = dailySpendSeries(transactions, month, totalBudget);

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

  return (
    <Card>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
      <div className="h-44 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(128,128,128,0.12)" />
            <XAxis
              dataKey="day"
              type="number"
              domain={[1, lastDay]}
              ticks={ticks}
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              tickFormatter={(d: number) => `${d} ${monthShort}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
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
              cursor={cursorStyle()}
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
            {!isMobile && (
              <Legend
                iconType="plainline"
                iconSize={16}
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    cumulative: "Spent",
                    pace: "Budget pace",
                    projection: "Projected",
                  };
                  return labels[value] ?? value;
                }}
              />
            )}
            {totalBudget > 0 && (
              <Line
                type="monotone"
                dataKey="pace"
                stroke="#9ca3af"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                activeDot={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="projection"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              connectNulls={false}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#4f46e5"
              strokeWidth={2.5}
              fill="url(#spendGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
