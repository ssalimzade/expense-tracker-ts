import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { RentData } from "../../types/rent";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, CHART, axisTick, gridStroke } from "../../lib/chart";
import { gbp0 } from "../../lib/format";
import { rentIsPaid, rentShare } from "../../lib/rent";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Card } from "../common";
import ChartLegend from "../ChartLegend";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "short" });
const money = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const tick = (v: number) => (v >= 1000 ? `£${(v / 1000).toFixed(1)}k` : `£${v}`);

/** Rent dwarfs every bill, so the breakdown leaves it out and names it instead. */
const RENT_KEY = "flat";

// A calm hue per bill; anything new falls back to grey.
const ITEM_COLORS: Record<string, string> = {
  wifi: CHART.slate,
  energy: CHART.moss,
  water: CHART.dusk,
  water_savings: CHART.teal,
  council_tax: CHART.lavender,
  hot_water: CHART.sand,
};

/** Stacked monthly bills (your share), rent aside. */
export function CostBreakdownChart({ data, months }: { data: RentData; months: string[] }) {
  const isMobile = useIsMobile();
  const bills = data.items.filter((it) => it.key !== RENT_KEY);
  const rentItem = data.items.find((it) => it.key === RENT_KEY);
  const rows = months.map((m) => {
    const row: Record<string, number | string> = { month: mo(m) };
    // Your share, not the gross bill — the chart tracks what the months cost you.
    for (const it of bills) row[it.label] = rentShare(data, m, it.key);
    return row;
  });
  const rentPerMonth = rentItem && months.length
    ? months.reduce((s, m) => s + rentShare(data, m, RENT_KEY), 0) / months.length
    : 0;

  return (
    <Card>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Bills each month
        </h2>
        {rentPerMonth > 0 && (
          <span className="text-[11px] tabular-nums text-gray-400">+ rent ~{gbp0(rentPerMonth)}/mo, not shown</span>
        )}
      </div>
      <ChartLegend
        className="mb-3"
        items={bills.map((it) => ({ label: it.label, color: ITEM_COLORS[it.key] ?? CHART.grey }))}
      />
      <div className="h-52 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={isMobile ? "18%" : "24%"}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis tick={axisTick} width={40} tickFormatter={tick} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => money(v)}
              itemSorter={(item) => -(item.value as number)}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            {bills.map((it, i) => (
              <Bar
                key={it.key}
                dataKey={it.label}
                stackId="a"
                fill={ITEM_COLORS[it.key] ?? CHART.grey}
                radius={i === bills.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Paid vs still-outstanding per month (auto-matched transactions count as paid). */
export function PaidProgressChart({ data, months }: { data: RentData; months: string[] }) {
  const isMobile = useIsMobile();
  const rows = months.map((m) => {
    let paid = 0;
    let outstanding = 0;
    for (const it of data.items) {
      const amount = rentShare(data, m, it.key);
      if (rentIsPaid(data, m, it.key)) paid += amount;
      else outstanding += amount;
    }
    return { month: mo(m), Paid: paid, Outstanding: outstanding };
  });

  return (
    <Card>
      <div className="mb-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Paid vs Outstanding
        </h2>
      </div>
      <ChartLegend
        className="mb-3"
        items={[
          { label: "Paid", color: CHART.teal },
          { label: "Outstanding", color: "rgba(148,163,184,0.55)" },
        ]}
      />
      <div className="h-52 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 4, left: 0 }} barCategoryGap={isMobile ? "18%" : "24%"}>
            <CartesianGrid vertical={false} stroke={gridStroke} />
            <XAxis dataKey="month" tick={{ ...axisTick, fontSize: isMobile ? 10 : 11 }} axisLine={false} tickLine={false} interval={isMobile ? 1 : 0} />
            <YAxis tick={axisTick} width={40} tickFormatter={tick} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => money(v)}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Bar dataKey="Paid" stackId="a" fill={CHART.teal} />
            <Bar dataKey="Outstanding" stackId="a" fill={CHART.mist} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
