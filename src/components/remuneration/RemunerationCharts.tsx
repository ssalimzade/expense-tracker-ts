import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { RemunerationRow } from "../../types/remuneration";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { Card } from "../common";

// "Sep 2022 - Jan 2023" → "Sep '22"
const shortLabel = (period: string) => {
  const start = period.split(" - ")[0].trim(); // "Sep 2022" or "Jan 2024"
  const [a, b] = start.split(" ");
  if (b && b.length === 4) return `${a} '${b.slice(2)}`;
  return start;
};

export function PayGrowthChart({ rows }: { rows: RemunerationRow[] }) {
  const data = rows.map((r) => ({
    period: shortLabel(r.period),
    "Net p.m": Math.round(r.net_pm),
    "Gross p.a": r.gross,
  }));

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Pay Progression
        </h2>
      </div>
      <div className="min-h-[16rem] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="netPmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="period" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={42} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} width={56} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar yAxisId="left" dataKey="Gross p.a" fill="#c7d2fe" radius={[4, 4, 0, 0]} barSize={22} />
            <Area yAxisId="right" type="monotone" dataKey="Net p.m" stroke="#6366f1" strokeWidth={2.5} fill="url(#netPmGradient)" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
