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

export default function HistoryTab() {
  const monthsQuery = useArchiveMonths();
  const [month, setMonth] = useState<string | null>(null);
  const archiveQuery = useArchive(month);
  const allMonths = monthsQuery.data ?? [];
  const allArchives = useAllArchives(allMonths);
  const qc = useQueryClient();

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
    <div className="space-y-4">
      {/* Month selector */}
      <QueryState isLoading={monthsQuery.isLoading} error={monthsQuery.error}>
        <div className="flex flex-wrap items-center gap-1.5">
          {allMonths.map((m) => (
            <button
              key={m}
              onClick={() => setMonth(m)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                m === month
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-700"
              }`}
            >
              {m}
            </button>
          ))}
          {month && (
            <button
              onClick={() => refreshSnapshot.mutate(month)}
              disabled={refreshSnapshot.isPending}
              title="Recompute and overwrite this month's snapshot from live data"
              className="ml-2 rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 ring-1 ring-indigo-200 transition-all hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:ring-indigo-800 dark:hover:bg-indigo-950/40"
            >
              {refreshSnapshot.isPending ? "Refreshing…" : "Refresh snapshot"}
            </button>
          )}
        </div>
      </QueryState>

      {/* Historical spending chart (all months) */}
      {allArchives.data.length > 1 && (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  width={52}
                  tickFormatter={(v) => `£${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number, name: string) => [gbp(v), name === "spent" ? "Spent" : "Budget"]}
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
                    label={{ value: "avg", position: "right", fontSize: 10, fill: "#9ca3af" }}
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
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "Budget", value: totalBudget, color: "text-gray-900 dark:text-white", bg: "bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700" },
                { label: "Spent", value: totalSpent, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900" },
                { label: "Remaining", value: totalRemaining, color: totalRemaining < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400", bg: totalRemaining < 0 ? "bg-red-50/60 border-red-100 dark:bg-red-950/40 dark:border-red-900" : "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900" },
              ].map((m) => (
                <div key={m.label} className={`rounded-2xl border px-2.5 py-2 text-center sm:px-5 sm:py-4 ${m.bg}`}>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500 sm:text-xs">{m.label}</p>
                  <p className={`mt-1 text-lg font-bold sm:mt-1.5 sm:text-2xl ${m.color}`}>{gbp(m.value)}</p>
                </div>
              ))}
            </div>

            {/* Per-category bar chart for selected month */}
            <Card>
              <div className="mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
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
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center bg-indigo-600 dark:bg-indigo-900 px-6 py-4">
                <h2 className="text-sm font-bold text-white">Category Breakdown</h2>
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
                        <td className="px-6 py-3 text-center text-white dark:text-white">{gbp(row["Budget (£)"])}</td>
                        <td className="px-6 py-3 text-center text-white dark:text-white">{gbp(row["Spent (£)"])}</td>
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
                    <li key={i} className="px-6 py-2.5">
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
                <li className="flex items-center justify-between border-t-2 border-gray-200 px-6 py-3 text-sm font-bold dark:border-gray-700">
                  <span className="uppercase tracking-wider text-gray-900 dark:text-white">Total</span>
                  <span className="flex items-center gap-3">
                    <span className="text-gray-500 dark:text-gray-400">Spent {gbp(totalSpent)}</span>
                    <span className={totalRemaining < 0 ? "text-red-600" : "text-emerald-600"}>{gbp(totalRemaining)}</span>
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
