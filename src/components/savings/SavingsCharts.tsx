import {
  ComposedChart, Line, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { SavingsRow } from "../../types/savings";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, CHART, axisTick, gridStroke } from "../../lib/chart";
import ChartLegend from "../ChartLegend";
import { useIsMobile } from "../../hooks/useIsMobile";

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
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mb-4 flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Balance through the year</p>
        {rows.length > 0 && (
          <span className="text-sm font-bold tabular-nums text-[#5d7a45] dark:text-[#a9c48f]">
            {"→ "}£{lastBalance.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
          </span>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8fae73" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#8fae73" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis
              tick={axisTick}
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
              stroke="#8fae73"
              strokeWidth={2.5}
              fill="url(#balanceGradient)"
              dot={{ r: 3, fill: "#8fae73" }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
            <Line
              type="monotone"
              dataKey="future"
              stroke="#8fae73"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              dot={{ r: 3, fill: "#8fae73" }}
              activeDot={{ r: 5 }}
              connectNulls={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const BREAKDOWN_SERIES = [
  { key: "Home", color: CHART.dusk },
  { key: "Savings", color: CHART.moss },
  { key: "Adjustments", color: CHART.sand },
  { key: "Investments", color: CHART.lavender },
] as const;

const niceUp = (v: number) => {
  const step = v > 2500 ? 1000 : v > 500 ? 250 : 50;
  return Math.ceil(v / step) * step;
};

export function MonthlyBreakdownChart({ rows, showInvestments }: { rows: SavingsRow[]; showInvestments: boolean }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({
    month: mo(r.start_date),
    Home: r.home_contributions,
    Savings: r.savings,
    Adjustments: r.adjustments,
    ...(showInvestments ? { Investments: r.investments ?? 0 } : {}),
  }));
  const series = BREAKDOWN_SERIES.filter((s) => showInvestments || s.key !== "Investments");

  // One huge month (a bonus, a transfer) flattens every other bar. When a month
  // is well over twice the typical one, cap the scale and name it instead.
  const positive = (d: (typeof data)[number]) =>
    series.reduce((s, x) => s + Math.max(0, (d as Record<string, number | string>)[x.key] as number), 0);
  const totals = data.map(positive);
  const sorted = [...totals].filter((t) => t > 0).sort((a, b) => a - b);
  const typical = sorted.length ? sorted[Math.floor((sorted.length - 1) * 0.75)] : 0;
  const capped = typical > 0 && Math.max(0, ...totals) > typical * 2.5;
  const lowest = Math.min(0, ...data.map((d) => series.reduce((s, x) => s + Math.min(0, (d as Record<string, number | string>)[x.key] as number), 0)));
  // Even ticks on the capped scale, reaching down far enough for negative months.
  const step = capped ? niceUp((typical * 1.4) / 3) : 0;
  const cap = capped ? step * 3 : undefined;
  const floor = capped && lowest < 0 ? -Math.ceil(-lowest / 50) * 50 : 0;
  const ticks = capped ? [0, step, step * 2, step * 3] : undefined;
  const offScale = cap ? data.map((d, i) => ({ month: d.month, total: totals[i] })).filter((d) => d.total > cap) : [];

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">What went in each month</p>
        {offScale.length > 0 && (
          <span className="text-[11px] tabular-nums text-gray-400">
            Off the top: {offScale.map((d) => `${d.month} £${d.total.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`).join(", ")}
          </span>
        )}
      </div>
      <ChartLegend className="mb-3" items={series.map((s) => ({ label: s.key, color: s.color }))} />
      <div className="h-52 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={isMobile ? "18%" : "24%"}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis
              tick={axisTick}
              width={44}
              domain={cap ? [floor, cap] : undefined}
              ticks={ticks}
              allowDataOverflow={capped}
              tickFormatter={(v) => (Math.abs(v) >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `${v < 0 ? "−" : ""}£${Math.abs(v)}`)}
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
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.45)" />
            {series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} stackId="a" fill={s.color} radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
