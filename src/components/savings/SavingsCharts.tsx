import {
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { SavingsRow } from "../../types/savings";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, axisTick, gridStroke } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";

const mo = (iso: string) => new Date(iso).toLocaleString("en-GB", { month: "short" });
const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

export function SavingsGrowthChart({ rows }: { rows: SavingsRow[] }) {
  const isMobile = useIsMobile();
  const line = "#8fae73";
  const tickStyle = axisTick;
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
  const lastMonth = rows.length ? new Date(rows[rows.length - 1].start_date).toLocaleString("en-GB", { month: "long" }) : "";
  // Even, whole-thousand Y ticks (e.g. 0 / 3k / 6k / 9k / 12k) instead of the
  // ragged auto ticks recharts would otherwise pick.
  const step = Math.max(1000, Math.ceil(max / 4 / 1000) * 1000);
  const niceMax = Math.max(step, Math.ceil(max / step) * step);
  const yTicks: number[] = [];
  for (let v = 0; v <= niceMax; v += step) yTicks.push(v);

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 18, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={line} stopOpacity={0.2} />
            <stop offset="95%" stopColor={line} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis dataKey="month" tick={{ ...tickStyle, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
        <YAxis
          tick={tickStyle}
          width={44}
          tickFormatter={(v) => (v === 0 ? "£0" : `£${(v / 1000).toFixed(0)}k`)}
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
          stroke={line}
          strokeWidth={2.5}
          fill="url(#balanceGradient)"
          dot={{ r: 3, fill: line }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="future"
          stroke={line}
          strokeWidth={2.5}
          strokeDasharray="5 4"
          dot={{ r: 3, fill: line }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Balance through the year</p>
        {rows.length > 0 && (
          <span className="text-sm font-bold tabular-nums text-[#5d7a45] dark:text-[#a9c48f]">
            {lastMonth} £{lastBalance.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
      <div className="h-56">{chart}</div>
    </div>
  );
}
