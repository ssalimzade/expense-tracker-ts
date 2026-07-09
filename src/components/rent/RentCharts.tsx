import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { RentData, RentLineItem } from "../../types/rent";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Card } from "../common";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "short" });
const blank: RentLineItem = { amount: 0, paid: false };

// Distinct hues per line item; saved (quarterly) items lean amber.
const ITEM_COLORS: Record<string, string> = {
  flat: "#6366f1",
  wifi: "#0ea5e9",
  energy: "#14b8a6",
  water: "#f59e0b",
  council_tax: "#8b5cf6",
  hot_water: "#f97316",
};

/** Stacked monthly cost, broken down by line item. */
export function CostBreakdownChart({ data, months }: { data: RentData; months: string[] }) {
  const isMobile = useIsMobile();
  const rows = months.map((m) => {
    const entry = data.months[m] ?? {};
    const row: Record<string, number | string> = { month: mo(m) };
    for (const it of data.items) row[it.label] = (entry[it.key] ?? blank).amount;
    return row;
  });

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Cost Breakdown
        </h2>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={isMobile ? 0 : undefined} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            {!isMobile && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />}
            {data.items.map((it, i) => (
              <Bar
                key={it.key}
                dataKey={it.label}
                stackId="a"
                fill={ITEM_COLORS[it.key] ?? "#9ca3af"}
                radius={i === data.items.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
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
  const reconciled = data.reconciled ?? {};
  const rows = months.map((m) => {
    const entry = data.months[m] ?? {};
    let paid = 0;
    let outstanding = 0;
    for (const it of data.items) {
      const c = entry[it.key] ?? blank;
      if (c.paid || reconciled[m]?.[it.key]) paid += c.amount;
      else outstanding += c.amount;
    }
    return { month: mo(m), Paid: paid, Outstanding: outstanding };
  });

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Paid vs Outstanding
        </h2>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: isMobile ? 9 : 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval={isMobile ? 0 : undefined} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="Paid" stackId="a" fill="#10b981" />
            <Bar dataKey="Outstanding" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
