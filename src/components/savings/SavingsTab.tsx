import { useState } from "react";
import { useSavings } from "../../hooks/useSavings";
import { QueryState } from "../common";
import SavingsTable from "./SavingsTable";
import { SavingsGrowthChart, MonthlyBreakdownChart } from "./SavingsCharts";
import { gbp0 } from "../../lib/format";

const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

export default function SavingsTab() {
  const savingsQuery = useSavings();
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);

  return (
    <QueryState isLoading={savingsQuery.isLoading} error={savingsQuery.error}>
      {(() => {
        const allRows = savingsQuery.data ?? [];

        const years = [...new Set(allRows.map((r) => r.start_date.slice(0, 4)))].sort();
        const rows = allRows.filter((r) => r.start_date.startsWith(year));
        const showInvestments = year === "2026";

        // Year stats (only count months that have actually happened).
        const elapsed = rows.filter((r) => r.start_date.slice(0, 7) <= currentKey);
        const latest = elapsed[elapsed.length - 1];
        const sum = (k: "savings" | "investments" | "home_contributions") =>
          elapsed.reduce((s, r) => s + (r[k] ?? 0), 0);
        const totalSaved = sum("savings");
        const avgPerMonth = elapsed.length ? totalSaved / elapsed.length : 0;

        const stats = [
          { label: "Current Balance", short: "Balance", value: latest?.ending_balance ?? 0, sub: "", color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50/60 border-teal-100 dark:bg-teal-950/30 dark:border-teal-900" },
          { label: "Saved this year", short: "Saved", value: totalSaved, sub: `avg ${gbp0(avgPerMonth)}/mo`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900" },
          ...(showInvestments
            ? [{ label: "Invested", short: "Invested", value: sum("investments"), sub: "", color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50/60 border-purple-100 dark:bg-purple-950/30 dark:border-purple-900" }]
            : []),
          { label: "Home Contributions", short: "Home", value: sum("home_contributions"), sub: "", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50/60 border-sky-100 dark:bg-sky-950/30 dark:border-sky-900" },
        ];

        return (
          <div className="space-y-4">
            {/* Year tabs */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div className="flex gap-1.5 rounded-xl bg-gray-100 p-1 dark:bg-gray-800 w-fit">
                {years.map((y) => (
                  <button
                    key={y}
                    onClick={() => setYear(y)}
                    className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${
                      y === year
                        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                        : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Wyndham deposit reference */}
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0">
                  <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm9 3a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM6.92 6.085c.081-.16.19-.299.34-.398.145-.097.371-.187.74-.187.28 0 .553.087.738.225A.613.613 0 0 1 9 6.25c0 .177-.04.264-.077.315a.807.807 0 0 1-.208.186 1.98 1.98 0 0 1-.289.128l-.05.017A2.5 2.5 0 0 0 7.6 7.4a.75.75 0 0 0 1.4.535c.05-.13.1-.21.142-.262a.91.91 0 0 1 .085-.081c.06-.048.154-.104.302-.166a3.48 3.48 0 0 0 .51-.24c.25-.165.47-.38.622-.651.152-.273.239-.58.239-.9a2.11 2.11 0 0 0-.76-1.64C9.672 4.26 9.115 4 8 4c-.64 0-1.26.18-1.74.507a2.61 2.61 0 0 0-.94 1.15.75.75 0 0 0 1.4.486c.044-.1.1-.18.2-.253Z" clipRule="evenodd" />
                </svg>
                Wyndham deposit: £1,900 (separate from savings balance)
              </div>
            </div>

            {/* Year summary stats */}
            <div className={`grid gap-2 sm:gap-3 ${stats.length === 4 ? "grid-cols-4 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-3"}`}>
              {stats.map((s) => (
                <div key={s.label} className={`rounded-2xl border px-1.5 py-2 text-center sm:px-5 sm:py-4 ${s.bg}`}>
                  <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-500 sm:text-xs sm:tracking-wider">
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </p>
                  <p className={`mt-1 text-sm font-bold sm:mt-1.5 sm:text-2xl ${s.color}`}>{gbp0(s.value)}</p>
                  {s.sub && <p className="mt-0.5 hidden truncate text-xs text-gray-400 sm:block">{s.sub}</p>}
                </div>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SavingsGrowthChart rows={rows} />
              <MonthlyBreakdownChart rows={rows} showInvestments={showInvestments} />
            </div>

            <SavingsTable
              rows={rows}
              showInvestments={showInvestments}
              seedDate={allRows.reduce((min, r) => (!min || r.start_date < min ? r.start_date : min), "")}
            />
          </div>
        );
      })()}
    </QueryState>
  );
}
