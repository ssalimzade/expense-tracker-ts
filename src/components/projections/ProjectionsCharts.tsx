import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import type { ProjectionView } from "../../types/projections";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, CHART, axisTick, gridStroke } from "../../lib/chart";
import { gbp0 } from "../../lib/format";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Card } from "../common";
import ChartLegend from "../ChartLegend";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "short" });

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

/** Months still to come are drawn fainter, so the plan reads apart from what happened. */
const monthOpacity = (month: string) => (month > currentMonth ? 0.45 : 1);

const money = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const kTick = (v: number) =>
  v === 0 ? "£0" : `${v < 0 ? "−" : ""}£${(Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 || v % 1000 === 0 ? 0 : 1)}k`;

const ALLOCATION_SERIES = [
  { key: "Costs", color: CHART.stone },
  { key: "Home", color: CHART.dusk },
  { key: "Savings", color: CHART.moss },
  { key: "Investments", color: CHART.lavender },
  { key: "Buffer", color: CHART.mist },
] as const;

/** Where the money goes each month: costs vs the allocation buckets, stacked. */
export function AllocationChart({ rows }: { rows: ProjectionView[] }) {
  const isMobile = useIsMobile();
  const data = rows.map((r) => ({
    month: mo(r.month),
    key: r.month,
    Costs: r.totalCosts,
    Home: r.home_contributions,
    Savings: r.savings,
    Investments: r.investments,
    Buffer: Math.max(r.buffer, 0),
  }));

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Where the money goes
        </h2>
        <span className="text-[11px] text-gray-400">faded = still to come</span>
      </div>
      <ChartLegend className="mb-3" items={ALLOCATION_SERIES.map((s) => ({ label: s.key, color: s.color }))} />
      <div className="h-56 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={isMobile ? "18%" : "24%"}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis tick={axisTick} width={40} tickFormatter={kTick} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => money(v)}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            {ALLOCATION_SERIES.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="a"
                fill={s.color}
                radius={i === ALLOCATION_SERIES.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              >
                {data.map((d) => (
                  <Cell key={d.key} fillOpacity={monthOpacity(d.key)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface LeftoverDatum {
  month: string;
  key: string;
  income: number;
  costs: number;
  leftover: number;
}

function LeftoverTooltip({ active, payload }: { active?: boolean; payload?: { payload: LeftoverDatum }[] }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const row = (label: string, value: string, strong = false) => (
    <div className="flex justify-between gap-6">
      <span style={tooltipItemStyle}>{label}</span>
      <span className={`tabular-nums ${strong ? "font-bold" : ""}`} style={strong ? undefined : tooltipItemStyle}>
        {value}
      </span>
    </div>
  );
  return (
    <div style={tooltipStyle()}>
      <p style={tooltipLabelStyle} className="mb-1">
        {new Date(`${d.key}-01`).toLocaleString("en-GB", { month: "long", year: "numeric" })}
      </p>
      {row("Income", money(d.income))}
      {row("Costs", money(d.costs))}
      <div className="mt-1 border-t border-gray-200 pt-1 dark:border-gray-700">
        {row("Left over", `${d.leftover < 0 ? "−" : ""}${money(Math.abs(d.leftover))}`, true)}
      </div>
    </div>
  );
}

/**
 * What's left of each month's income once costs are paid — the gap between
 * salary and costs, on its own scale so small months don't vanish next to
 * £4k bars.
 */
export function LeftoverChart({ rows }: { rows: ProjectionView[] }) {
  const isMobile = useIsMobile();
  const data: LeftoverDatum[] = rows.map((r) => {
    const income = r.salary + r.bonus + r.other_pl;
    return { month: mo(r.month), key: r.month, income, costs: r.totalCosts, leftover: income - r.totalCosts };
  });
  const elapsed = data.filter((d) => d.key <= currentMonth);
  const avg = elapsed.length ? elapsed.reduce((s, d) => s + d.leftover, 0) / elapsed.length : 0;

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Left after costs
        </h2>
        {elapsed.length > 0 && (
          <span className="text-xs tabular-nums text-gray-400">
            avg {avg < 0 ? "−" : ""}{gbp0(Math.abs(avg))}/mo so far
          </span>
        )}
      </div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Income minus costs", color: CHART.moss },
          { label: "Short", color: CHART.bad },
        ]}
      />
      <div className="h-56 sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={isMobile ? "18%" : "24%"}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis tick={axisTick} width={40} tickFormatter={kTick} axisLine={false} tickLine={false} />
            <Tooltip content={<LeftoverTooltip />} cursor={cursorStyle()} />
            <ReferenceLine y={0} stroke="rgba(148,163,184,0.45)" />
            <Bar dataKey="leftover" radius={[4, 4, 4, 4]}>
              {data.map((d) => (
                <Cell key={d.key} fill={d.leftover < 0 ? CHART.bad : CHART.moss} fillOpacity={monthOpacity(d.key)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
