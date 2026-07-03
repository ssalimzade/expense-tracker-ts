import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import type { ProjectionView } from "../../types/projections";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { Card } from "../common";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "short" });

/** Where the money goes each month: costs vs the allocation buckets, stacked. */
export function AllocationChart({ rows }: { rows: ProjectionView[] }) {
  const data = rows.map((r) => ({
    month: mo(r.month),
    Costs: r.totalCosts,
    Home: r.home_contributions,
    Savings: r.savings,
    Investments: r.investments,
    Buffer: Math.max(r.buffer, 0),
  }));

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Where the money goes
        </h2>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="Costs" stackId="a" fill="#f97316" />
            <Bar dataKey="Home" stackId="a" fill="#0ea5e9" />
            <Bar dataKey="Savings" stackId="a" fill="#10b981" />
            <Bar dataKey="Investments" stackId="a" fill="#a855f7" />
            <Bar dataKey="Buffer" stackId="a" fill="#d1d5db" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/** Salary vs total costs, with the leftover (income − costs) as a line. */
export function SalaryVsCostChart({ rows }: { rows: ProjectionView[] }) {
  const data = rows.map((r) => ({
    month: mo(r.month),
    Salary: r.salary + r.bonus,
    Costs: r.totalCosts,
    Leftover: r.salary + r.bonus + r.other_pl - r.totalCosts,
  }));

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Salary vs Costs
        </h2>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} width={48} tickFormatter={(v) => `£${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()}
            />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            <ReferenceLine y={0} stroke="#e5e7eb" />
            <Bar dataKey="Salary" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={14} />
            <Bar dataKey="Costs" fill="#f97316" radius={[4, 4, 0, 0]} barSize={14} />
            <Line type="monotone" dataKey="Leftover" stroke="#14b8a6" strokeWidth={2.5} dot={{ r: 3, fill: "#14b8a6" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
