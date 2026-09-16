import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArchiveMonths, useArchive, useAllArchives } from "../../hooks/useArchive";
import { recomputeArchive } from "../../api/archive";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, QueryState } from "../common";
import { gbp0 as gbp, formatMonthLabel } from "../../lib/format";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle, CHART, axisTick, gridStroke } from "../../lib/chart";
import ChartLegend from "../ChartLegend";
import { HeroChartHeader, HeroLineChart } from "../HeroCharts";
import CategoryBreakdownTable from "../dashboard/CategoryBreakdownTable";
import PhoneSectionTabs, { usePhoneSection } from "../PhoneSections";

const SECTIONS = [
  { value: "categories", label: "Categories" },
  { value: "charts", label: "Charts" },
] as const;
import { useIsMobile } from "../../hooks/useIsMobile";
import Hero, { HeroProgress } from "../Hero";
import { RewindClockArt, IN_COLUMN } from "../HeroArt";

// "2026-06" → "Jun '26" for chart axes (month name + short year across years).
const monthTick = (m: string) => {
  if (!m || !m.includes("-")) return m;
  const [y, mm] = m.split("-");
  const d = new Date(Number(y), Number(mm) - 1, 1);
  return `${d.toLocaleString("en-GB", { month: "short" })} '${y.slice(2)}`;
};

export default function HistoryTab() {
  const monthsQuery = useArchiveMonths();
  const [month, setMonth] = useState<string | null>(null);
  const archiveQuery = useArchive(month);
  const allMonths = monthsQuery.data ?? [];
  const allArchives = useAllArchives(allMonths);
  const qc = useQueryClient();
  const section = usePhoneSection("history-section", SECTIONS);

  const refreshSnapshot = useMutation({
    mutationFn: (m: string) => recomputeArchive(m),
    onSuccess: (_, m) => {
      qc.invalidateQueries({ queryKey: ["archive", m] });
      qc.invalidateQueries({ queryKey: ["archive-months"] });
    },
  });

  useEffect(() => {
    if (!month && allMonths.length) {
      setMonth(allMonths[allMonths.length - 1]);
    }
  }, [month, allMonths]);

  // Filter out Uncategorized from the per-month detail view
  const rows = (archiveQuery.data ?? []).filter((r) => r.Category !== "Uncategorized");
  const totalBudget = rows.reduce((s, r) => s + r["Budget (£)"], 0);
  const totalSpent = rows.reduce((s, r) => s + r["Spent (£)"], 0);
  const totalRemaining = totalBudget - totalSpent;

  const avgSpend = allArchives.data.length > 0
    ? allArchives.data.reduce((s, d) => s + d.spent, 0) / allArchives.data.length
    : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Month strip */}
      <QueryState isLoading={monthsQuery.isLoading} error={monthsQuery.error}>
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
          {[...allMonths].reverse().map((m) => {
            const [y, mm] = m.split("-").map(Number);
            const active = m === month;
            return (
              <button
                key={m}
                onClick={() => setMonth(m)}
                className={`shrink-0 rounded-2xl px-4 py-2 text-left transition ${
                  active
                    ? "bg-gray-900 text-white shadow-md dark:bg-white dark:text-gray-900"
                    : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
                }`}
              >
                <span className="block text-sm font-bold">
                  {new Date(y, mm - 1, 1).toLocaleString("en-GB", { month: "short" })}
                </span>
                <span className={`block text-[11px] tabular-nums ${active ? "opacity-60" : "text-gray-400"}`}>{y}</span>
              </button>
            );
          })}
        </div>
      </QueryState>

      {month && (
        <Hero
          gradient="from-slate-600 via-slate-700 to-indigo-900 dark:from-slate-700 dark:via-slate-800 dark:to-indigo-950"
          badge={
            <span className="flex items-center gap-2">
              {formatMonthLabel(month)} · snapshot
            </span>
          }
          label="Spent"
          value={archiveQuery.isSuccess ? gbp(totalSpent) : "—"}
          decoration={
            <RewindClockArt className={IN_COLUMN} />
          }
          under={
            archiveQuery.isSuccess && (
            <div className="max-w-xl space-y-1.5">
              <HeroProgress pct={totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0} danger={totalRemaining < 0} />
              <p className="text-xs text-white/80 tabular-nums">
                {totalBudget > 0 ? `${Math.round((totalSpent / totalBudget) * 100)}% of ${gbp(totalBudget)}` : "No budget set"}
              </p>
            </div>
            )
          }
          fields={!archiveQuery.isSuccess ? [] : [
            { label: "Budget", value: gbp(totalBudget) },
            { label: totalRemaining < 0 ? "Over budget" : "Left over", value: gbp(Math.abs(totalRemaining)), warn: totalRemaining < 0 },
            ...(avgSpend > 0
              ? [{ label: "Against average", value: `${totalSpent >= avgSpend ? "+" : "−"}${gbp(Math.abs(totalSpent - avgSpend))}`, sub: `average ${gbp(avgSpend)} a month` }]
              : []),
          ]}
          asideFrom="lg"
          aside={
            allArchives.data.length > 1 ? (
              <div className="w-[26rem] xl:w-[32rem]">
                <HeroChartHeader title="Spending over time" note={`${gbp(avgSpend)} a month on average`} />
                <HeroLineChart
                  className="h-32"
                  labelKey="label"
                  format={gbp}
                  series={[
                    { key: "spent", label: "Spent", kind: "area" },
                    { key: "budget", label: "Budget", kind: "dashed" },
                  ]}
                  data={allArchives.data.map((d) => ({ ...d, label: formatMonthLabel(d.month) }))}
                />
              </div>
            ) : undefined
          }
        >
            <button
              onClick={() => refreshSnapshot.mutate(month)}
              disabled={refreshSnapshot.isPending}
              title="Recompute and overwrite this month's snapshot from live data"
              className="mt-5 flex w-fit items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-50 max-md:w-full max-md:justify-center"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${refreshSnapshot.isPending ? "animate-spin" : ""}`}>
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
              </svg>
              {refreshSnapshot.isPending ? "Refreshing…" : "Refresh snapshot"}
            </button>
        </Hero>
      )}

      {month && <PhoneSectionTabs sections={SECTIONS} value={section.value} onChange={section.change} />}

      {/* Historical spending chart (all months); wide screens show it in the header */}
      {allArchives.data.length > 1 && (
        <div className={`lg:hidden ${section.show("charts")}`}>
          <SpendingOverTime data={allArchives.data} avgSpend={avgSpend} selected={month} />
        </div>
      )}

      <QueryState isLoading={archiveQuery.isLoading} error={archiveQuery.error}>
        {!month ? (
          <p className="text-sm text-gray-400">Select a month above.</p>
        ) : (
          <>
            <OverUnder month={month} rows={rows} className={section.show("charts")} />

            {/* Category table — same style as dashboard budget table */}
            <Card className={`p-0 overflow-hidden max-md:!p-0 ${section.show("categories")}`}>
              <div className="flex items-center border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Category Breakdown</h2>
              </div>
              <CategoryBreakdownTable
                rows={rows.map((r) => ({ category: r.Category, budget: r["Budget (£)"], spent: r["Spent (£)"] }))}
                totals={{ budget: totalBudget, spent: totalSpent }}
              />

              {/* Mobile cards */}
              <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
                {rows.map((row, i) => {
                  const rem = row["Remaining (£)"];
                  const pct = row["Budget (£)"] > 0
                    ? (row["Spent (£)"] / row["Budget (£)"]) * 100
                    : row["Spent (£)"] > 0 ? 999 : 0;
                  return (
                    <li key={i} className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-gray-800 dark:text-gray-100">{row.Category}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">{gbp(row["Budget (£)"])}</span>
                      </div>
                      <div className="mt-2.5 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                          <div
                            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-gray-400">{pct > 999 ? "—" : `${pct.toFixed(0)}%`}</span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Spent {gbp(row["Spent (£)"])}</span>
                        <span className={`font-semibold ${rem < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {gbp(rem)} left
                        </span>
                      </div>
                    </li>
                  );
                })}
                <li className="flex items-center justify-between border-t-2 border-gray-200 px-4 py-3 text-sm font-bold dark:border-gray-700">
                  <span className="uppercase tracking-wider text-gray-900 dark:text-white">Total</span>
                  <span className="flex items-center gap-3">
                    <span className="text-gray-500 dark:text-gray-400">Spent {gbp(totalSpent)}</span>
                    <span className={totalRemaining < 0 ? "text-red-600" : "text-emerald-600"}>Left {gbp(totalRemaining)}</span>
                  </span>
                </li>
              </ul>
            </Card>
          </>
        )}
      </QueryState>
    </div>
  );
}

/**
 * How far each category landed from its budget, biggest misses first — the one
 * thing the table below doesn't show at a glance.
 */
function OverUnder({
  month,
  rows,
  className = "",
}: {
  month: string;
  rows: { Category: string; "Budget (£)": number; "Spent (£)": number }[];
  className?: string;
}) {
  const items = rows
    .filter((r) => r["Budget (£)"] > 0 || r["Spent (£)"] > 0)
    .map((r) => ({ category: r.Category, diff: r["Budget (£)"] - r["Spent (£)"] }))
    .sort((a, b) => a.diff - b.diff);
  const scale = Math.max(1, ...items.map((i) => Math.abs(i.diff)));

  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Over / under budget — {formatMonthLabel(month)}
        </h2>
        <ChartLegend
          items={[
            { label: "Under", color: CHART.moss },
            { label: "Over", color: CHART.bad },
          ]}
        />
      </div>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Nothing budgeted or spent this month.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((it) => {
            const over = it.diff < 0;
            const width = `${(Math.abs(it.diff) / scale) * 50}%`;
            return (
              <li key={it.category} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.75rem] items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)_7rem]">
                <span className="truncate text-gray-700 dark:text-gray-300">{it.category}</span>
                <div className="relative h-2.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="absolute inset-y-[-3px] left-1/2 w-px bg-gray-300 dark:bg-gray-600" />
                  <span
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      width,
                      backgroundColor: over ? CHART.bad : CHART.moss,
                      ...(over ? { left: "50%" } : { right: "50%" }),
                    }}
                  />
                </div>
                <span className={`text-right text-xs font-semibold tabular-nums ${Math.round(it.diff) === 0 ? "text-gray-400" : over ? "text-red-500 dark:text-red-400" : "text-[#5d7a45] dark:text-[#a9c48f]"}`}>
                  {Math.round(it.diff) === 0 ? "on budget" : `${gbp(Math.abs(it.diff))} ${over ? "over" : "under"}`}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Spent vs budget for every archived month. */
function SpendingOverTime({
  data,
  avgSpend,
  selected,
}: {
  data: { month: string; spent: number; budget: number }[];
  avgSpend: number;
  selected: string | null;
}) {
  const isMobile = useIsMobile();
  const spentColor = CHART.indigo;
  const budgetColor = CHART.grey;
  const tick = axisTick;
  const gradientId = "historySpendGradient";

  const chart = (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={spentColor} stopOpacity={0.28} />
            <stop offset="95%" stopColor={spentColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={gridStroke} />
        <XAxis dataKey="month" tick={tick} tickFormatter={monthTick} interval={isMobile ? 2 : "preserveStartEnd"} axisLine={false} tickLine={false} />
        <YAxis
          tick={tick}
          width={48}
          tickCount={isMobile ? 4 : 5}
          tickFormatter={(v) => (v === 0 ? "£0" : `£${(v / 1000).toFixed(1)}k`)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(v: number, name: string) => [gbp(v), name === "spent" ? "Spent" : "Budget"]}
          labelFormatter={(m) => formatMonthLabel(m as string)}
          itemSorter={(item) => (item.dataKey === "spent" ? 0 : 1)}
          contentStyle={tooltipStyle()}
          itemStyle={tooltipItemStyle}
          labelStyle={tooltipLabelStyle}
          cursor={cursorStyle()}
        />
        {avgSpend > 0 && (
          <ReferenceLine
            y={avgSpend}
            stroke={CHART.grey}
            strokeOpacity={0.5}
            strokeDasharray="2 4"
            label={{ value: "average", position: "insideTopRight", fontSize: 10, fill: "#9ca3af" }}
          />
        )}
        {selected && <ReferenceLine x={selected} stroke="rgba(148,163,184,0.4)" />}
        <Line type="monotone" dataKey="budget" stroke={budgetColor} strokeWidth={1.5} strokeDasharray="5 4" dot={false} activeDot={{ r: 3 }} />
        <Area type="monotone" dataKey="spent" stroke={spentColor} strokeWidth={2.5} fill={`url(#${gradientId})`} dot={{ r: 2.5, fill: spentColor, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );

  const legend = [
    { label: "Spent", color: spentColor },
    { label: "Budget", color: budgetColor, dashed: true },
  ];

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Spending Over Time
        </h2>
        {avgSpend > 0 && (
          <span className="text-xs tabular-nums text-gray-400">average {gbp(avgSpend)} a month</span>
        )}
      </div>
      <ChartLegend className="mb-3" items={legend} />
      <div className="h-52 sm:h-56">{chart}</div>
    </Card>
  );
}
