import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useArchiveMonths, useArchive, useAllArchives } from "../../hooks/useArchive";
import { recomputeArchive } from "../../api/archive";
import {
  BarChart, Bar, ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { Card, QueryState } from "../common";
import { gbp0 as gbp, formatMonthLabel } from "../../lib/format";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { useIsMobile } from "../../hooks/useIsMobile";
import Hero, { HeroProgress } from "../Hero";

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
  const isMobile = useIsMobile();

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
            <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 text-white/10" aria-hidden>
              {[20, 45, 70, 95].map((r) => (
                <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 5" />
              ))}
            </svg>
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
              ? [{ label: "vs average", value: `${totalSpent >= avgSpend ? "+" : "−"}${gbp(Math.abs(totalSpent - avgSpend))}`, sub: `avg ${gbp(avgSpend)}/mo` }]
              : []),
          ]}
          aside={
            <button
              onClick={() => refreshSnapshot.mutate(month)}
              disabled={refreshSnapshot.isPending}
              title="Recompute and overwrite this month's snapshot from live data"
              className="flex items-center gap-1.5 rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur transition hover:bg-white/25 disabled:opacity-50 max-md:w-full max-md:justify-center"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 ${refreshSnapshot.isPending ? "animate-spin" : ""}`}>
                <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
              </svg>
              {refreshSnapshot.isPending ? "Refreshing…" : "Refresh snapshot"}
            </button>
          }
        />
      )}

      {/* Historical spending chart (all months) */}
      {allArchives.data.length > 1 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              Spending Over Time
            </h2>
            {avgSpend > 0 && (
              <span className="text-xs text-gray-400">avg {gbp(avgSpend)}/mo</span>
            )}
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={allArchives.data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <defs>
                  <linearGradient id="historySpendGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={monthTick} interval={isMobile ? 2 : undefined} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  width={52}
                  tickFormatter={(v) => `£${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [gbp(v), name === "spent" ? "Spent" : "Budget"]}
                  labelFormatter={(m) => formatMonthLabel(m as string)}
                  itemSorter={(item) => -(item.value as number)}
                  contentStyle={tooltipStyle()}
                  itemStyle={tooltipItemStyle}
                  labelStyle={tooltipLabelStyle}
                  cursor={cursorStyle()}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "12px" }}
                  formatter={(value) => value === "spent" ? "Spent" : "Budget"}
                />
                {avgSpend > 0 && (
                  <ReferenceLine
                    y={avgSpend}
                    stroke="#9ca3af"
                    strokeDasharray="4 2"
                    label={{ value: "avg", position: "insideTopRight", fontSize: 10, fill: "#9ca3af" }}
                  />
                )}
                <Area type="monotone" dataKey="budget" stroke="#4f46e5" strokeWidth={2.5} fill="url(#historySpendGradient)" dot={{ r: 3, fill: "#4f46e5" }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="spent" stroke="#c7d2fe" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <QueryState isLoading={archiveQuery.isLoading} error={archiveQuery.error}>
        {!month ? (
          <p className="text-sm text-gray-400">Select a month above.</p>
        ) : (
          <>
            {/* Per-category bar chart for selected month */}
            <Card>
              <div className="mb-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
                  Budget vs Spent — {formatMonthLabel(month)}
                </h2>
              </div>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows.filter((r) => r["Spent (£)"] > 0 || r["Budget (£)"] > 0)}
                    margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="Category" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} width={44} tickFormatter={(v) => `£${v}`} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number) => gbp(v)} contentStyle={tooltipStyle()} itemStyle={tooltipItemStyle} labelStyle={tooltipLabelStyle} cursor={cursorStyle()} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="Budget (£)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Spent (£)" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Category table — same style as dashboard budget table */}
            <Card className="p-0 overflow-hidden max-md:!p-0">
              <div className="flex items-center border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Category Breakdown</h2>
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] table-fixed text-sm">
                <colgroup>
                  <col className="w-56" />
                  <col className="w-40" />
                  <col className="w-40" />
                  <col className="w-40" />
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Budget</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Spent</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Remaining</th>
                    <th className="pl-2 pr-6 py-3 text-center text-xs font-semibold uppercase leading-tight text-gray-600 dark:text-white">% Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {rows.map((row, i) => {
                    const rem = row["Remaining (£)"];
                    const pct = row["Budget (£)"] > 0
                      ? (row["Spent (£)"] / row["Budget (£)"]) * 100
                      : row["Spent (£)"] > 0 ? 999 : 0;
                    return (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                        <td className="px-6 py-3 font-medium text-gray-700 dark:text-gray-300">{row.Category}</td>
                        <td className="px-6 py-3 text-center text-gray-900 dark:text-white">{gbp(row["Budget (£)"])}</td>
                        <td className="px-6 py-3 text-center text-gray-900 dark:text-white">{gbp(row["Spent (£)"])}</td>
                        <td className={`px-6 py-3 text-center font-semibold ${rem < 0 ? "text-red-500 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                          {gbp(rem)}
                        </td>
                        <td className="pl-2 pr-6 py-3">
                          <div className="flex items-center gap-1">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                              <div
                                className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500"}`}
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="w-7 shrink-0 text-center text-[10px] text-gray-400">{pct > 999 ? "—" : `${pct.toFixed(0)}%`}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700">
                    <td className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">Total</td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 dark:text-white">{gbp(totalBudget)}</td>
                    <td className="px-6 py-3 text-center font-bold text-gray-900 dark:text-white">{gbp(totalSpent)}</td>
                    <td className={`px-6 py-3 text-center font-bold ${totalRemaining < 0 ? "text-red-600" : "text-emerald-600"}`}>{gbp(totalRemaining)}</td>
                    <td className="px-6 py-3" />
                  </tr>
                </tfoot>
              </table>
              </div>

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
