import {
  ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import type { SavingsRow } from "../../types/savings";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Card } from "../common";

const mo = (iso: string) => new Date(iso).toLocaleString("en-GB", { month: "short" });
const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

export function SavingsGrowthChart({ rows }: { rows: SavingsRow[] }) {
  const isMobile = useIsMobile();
  // Split the series: year-to-date (solid line + shade) and future (dashed, no
  // shade). The future series starts at the current month so the lines connect.
  const data = rows.map((r) => {
    const key = r.start_date.slice(0, 7);
    return {
      month: mo(r.start_date),
      actual: key <= currentKey ? r.ending_balance : null,
      future: key >= currentKey ? r.ending_balance : null,
    };
  });

  const balances = rows.map((r) => r.ending_balance);
  const max = Math.max(...balances, 0);
  const lastBalance = rows[rows.length - 1]?.ending_balance ?? 0;
  // Even, whole-thousand Y ticks (e.g. 0 / 3k / 6k / 9k / 12k) instead of the
  // ragged auto ticks recharts would otherwise pick.
  const step = Math.max(1000, Math.ceil(max / 4 / 1000) * 1000);
  const niceMax = Math.max(step, Math.ceil(max / step) * step);
  const yTicks: number[] = [];
  for (let v = 0; v <= niceMax; v += step) yTicks.push(v);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Balance Growth
        </h2>
        {rows.length > 0 && (
          <span className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            £{lastBalance.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={isMobile ? 0 : undefined} />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={44}
              tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
              domain={[0, niceMax]}
              ticks={yTicks}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => [`£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`, "Balance"]}
              contentStyle={tooltipStyle()}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={cursorStyle()}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#14b8a6"
              strokeWidth={2.5}
              fill="url(#balanceGradient)"
              dot={{ r: 3, fill: "#14b8a6" }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="future"
              stroke="#14b8a6"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: "#14b8a6" }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export function MonthlyBreakdownChart({ rows, showInvestments }: { rows: SavingsRow[]; showInvestments: boolean }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({
    month: mo(r.start_date),
    Home: r.home_contributions,
    Savings: r.savings,
    Adjustments: r.adjustments,
    ...(showInvestments ? { Investments: r.investments ?? 0 } : {}),
  }));

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Monthly Breakdown
        </h2>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={isMobile ? 0 : undefined} />
            <YAxis
              tick={{ fontSize: 11, fill: "#9ca3af" }}
              width={isMobile ? 44 : 60}
              tickFormatter={(v) => (isMobile ? `£${(v / 1000).toFixed(1)}k` : `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()}
              itemStyle={tooltipItemStyle}
              labelStyle={tooltipLabelStyle}
              cursor={cursorStyle()}
            />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="Home" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Savings" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Adjustments" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            {showInvestments && (
              <Bar dataKey="Investments" stackId="a" fill="#a855f7" radius={[4, 4, 0, 0]} />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
