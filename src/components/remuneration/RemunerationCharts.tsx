import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import type { RemunerationRow } from "../../types/remuneration";
import { resolvePay } from "../../lib/remuneration";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, axisTick, gridStroke } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";

// "Sep 2022 - Jan 2023" → "Sep '22"
const shortLabel = (period: string) => {
  const start = period.split(" - ")[0].trim(); // "Sep 2022" or "Jan 2024"
  const [a, b] = start.split(" ");
  if (b && b.length === 4) return `${a} '${b.slice(2)}`;
  return start;
};

const VIEWS = {
  net: { label: "Net / month", color: "#10b981" },
  gross: { label: "Gross / year", color: "#14b8a6" },
} as const;
type View = keyof typeof VIEWS;

/**
 * One measure at a time on one scale — take-home a month, or the package a
 * year — instead of two axes that are hard to read against each other.
 */
export function PayGrowthChart({
  rows,
  variant = "card",
  note,
}: {
  rows: RemunerationRow[];
  variant?: "card" | "hero";
  /** Extra line in the hero header, e.g. overall growth. */
  note?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const hero = variant === "hero";
  const [view, setView] = useState<View>("net");
  const data = rows.map((r) => ({
    period: shortLabel(r.period),
    full: r.period,
    net: Math.round(resolvePay(r).net_pm),
    gross: r.gross,
  }));
  const color = hero ? "#ffffff" : VIEWS[view].color;
  const tickStyle = hero ? { fontSize: 11, fill: "rgba(255,255,255,0.65)" } : axisTick;
  const money = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

  const toggle = (
      <div className="flex gap-1 rounded-xl bg-gray-100 p-0.5 dark:bg-gray-800/70">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                v === view
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              }`}
            >
              {VIEWS[v].label}
            </button>
          ))}
        </div>
  );
  const heroToggle = (
        <div className="flex gap-1 rounded-xl bg-white/15 p-0.5">
          {(Object.keys(VIEWS) as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                v === view
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-white/75 hover:text-white"
              }`}
            >
              {VIEWS[v].label}
            </button>
          ))}
        </div>
  );
  const chart = (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 22, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id={`payGradient-${variant}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={hero ? "rgba(255,255,255,0.12)" : gridStroke} />
            <XAxis
              dataKey="period"
              tick={{ ...tickStyle, fontSize: isMobile ? 10 : 11 }}
              axisLine={false}
              tickLine={false}
              interval={isMobile ? "preserveStartEnd" : 0}
              minTickGap={isMobile ? 12 : 4}
            />
            <YAxis
              tick={tickStyle}
              width={44}
              tickFormatter={(v) => `£${(v / 1000).toFixed(view === "net" ? 1 : 0)}k`}
              axisLine={false}
              tickLine={false}
              domain={["dataMin - 200", "auto"]}
            />
            <Tooltip
              formatter={(v: number) => [money(v), VIEWS[view].label]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
              contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={hero ? { stroke: "rgba(255,255,255,0.35)" } : cursorStyle()}
            />
            <Area
              key={view}
              type="monotone"
              dataKey={view}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#payGradient-${variant})`}
              dot={{ r: 3, fill: color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
  );

  if (hero) {
    return (
      <div className="w-full">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Pay over time</p>
            {note && <p className="mt-0.5 text-sm font-semibold">{note}</p>}
          </div>
          {heroToggle}
        </div>
        <div className="h-40 w-[26rem] xl:w-[32rem]">{chart}</div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Pay over time</p>
        {toggle}
      </div>
      <div className="h-52 sm:h-60">{chart}</div>
    </div>
  );
}
