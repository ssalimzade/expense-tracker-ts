import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { RemunerationRow } from "../../types/remuneration";
import { resolvePay } from "../../lib/remuneration";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";

// "Sep 2022 - Jan 2023" → "Sep '22"
const shortLabel = (period: string) => {
  const start = period.split(" - ")[0].trim(); // "Sep 2022" or "Jan 2024"
  const [a, b] = start.split(" ");
  if (b && b.length === 4) return `${a} '${b.slice(2)}`;
  return start;
};

export function PayGrowthChart({ rows }: { rows: RemunerationRow[] }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({
    period: shortLabel(r.period),
    "Net p.m": Math.round(resolvePay(r).net_pm),
    "Gross p.a": r.gross,
  }));

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Pay over time</p>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="netPmGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="period" tick={{ fontSize: isMobile ? 8 : 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={0} angle={isMobile ? -45 : -15} textAnchor="end" height={isMobile ? 52 : 42} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#9ca3af" }} width={isMobile ? 40 : 56} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#9ca3af" }} width={isMobile ? 36 : 48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar yAxisId="left" dataKey="Gross p.a" fill="#99f6e4" fillOpacity={0.55} radius={[6, 6, 0, 0]} barSize={isMobile ? 14 : 26} />
            <Area yAxisId="right" type="monotone" dataKey="Net p.m" stroke="#10b981" strokeWidth={2.5} fill="url(#netPmGradient)" dot={{ r: 3, fill: "#10b981" }} activeDot={{ r: 5 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
