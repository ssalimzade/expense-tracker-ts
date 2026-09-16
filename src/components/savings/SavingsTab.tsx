import { useState } from "react";
import { useSavings } from "../../hooks/useSavings";
import { QueryState } from "../common";
import SavingsTable from "./SavingsTable";
import { SavingsGrowthChart, MonthlyBreakdownChart } from "./SavingsCharts";
import { gbp0 } from "../../lib/format";
import type { SavingsRow } from "../../types/savings";

const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const monthName = (iso: string) => new Date(iso).toLocaleString("en-GB", { month: "long" });

export default function SavingsTab() {
  const savingsQuery = useSavings();
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);

  const allRows = savingsQuery.data ?? [];
  const years = [...new Set(allRows.map((r) => r.start_date.slice(0, 4)))].sort();
  const rows = allRows.filter((r) => r.start_date.startsWith(year));
  const showInvestments = year === "2026";

  return (
    <QueryState isLoading={savingsQuery.isLoading} error={savingsQuery.error}>
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/70">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-xl px-4 py-1.5 text-sm font-semibold transition ${
                  y === year
                    ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-400/10 dark:text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Wyndham deposit £1,900 — kept separate from this balance
          </span>
        </div>

        {rows.length > 0 && <VaultHero rows={rows} year={year} showInvestments={showInvestments} />}

        <div className="grid gap-5 lg:grid-cols-2">
          <SavingsGrowthChart rows={rows} />
          <MonthlyBreakdownChart rows={rows} showInvestments={showInvestments} />
        </div>

        <SavingsTable
          rows={rows}
          showInvestments={showInvestments}
          seedDate={allRows.reduce((min, r) => (!min || r.start_date < min ? r.start_date : min), "")}
        />
      </div>
    </QueryState>
  );
}

function VaultHero({ rows, year, showInvestments }: { rows: SavingsRow[]; year: string; showInvestments: boolean }) {
  // Year stats only count months that have actually happened.
  const elapsed = rows.filter((r) => r.start_date.slice(0, 7) <= currentKey);
  const latest = elapsed[elapsed.length - 1];
  const sum = (k: "savings" | "investments" | "home_contributions") => elapsed.reduce((s, r) => s + (r[k] ?? 0), 0);
  const totalSaved = sum("savings");
  const avgPerMonth = elapsed.length ? totalSaved / elapsed.length : 0;

  const start = rows[0].starting_balance ?? 0;
  const yearEnd = rows[rows.length - 1].ending_balance;
  const now = latest?.ending_balance ?? start;
  const finished = elapsed.length === rows.length;
  // How far along the year's path from January's start to December's end.
  const progress = yearEnd > start ? Math.min(1, Math.max(0, (now - start) / (yearEnd - start))) : 1;

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 text-white shadow-lg shadow-orange-500/20 dark:from-amber-600 dark:via-orange-700 dark:to-rose-800 dark:shadow-none">
      {/* Stacked coins */}
      <svg viewBox="0 0 200 200" className="pointer-events-none absolute -right-6 -top-6 h-56 w-56 text-white/10" aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <ellipse key={i} cx="100" cy={150 - i * 22} rx="70" ry="18" fill="none" stroke="currentColor" strokeWidth="2" />
        ))}
      </svg>

      <div className="relative p-5 sm:p-7">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
          {latest ? `As of ${monthName(latest.start_date)} ${year}` : `${year} plan`}
        </span>
        <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Savings balance</p>
        <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{gbp0(now)}</p>

        <div className="mt-5 max-w-xl">
          <div className="h-2 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-white/80 tabular-nums">
            <span>{gbp0(start)} in January</span>
            <span>{finished ? `${gbp0(yearEnd)} at year end` : `On track for ${gbp0(yearEnd)} by December`}</span>
          </div>
        </div>

        <div className={`mt-6 grid grid-cols-2 gap-4 ${showInvestments ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          <HeroField label="Saved this year" value={gbp0(totalSaved)} sub={`avg ${gbp0(avgPerMonth)}/mo`} />
          <HeroField label="Home" value={gbp0(sum("home_contributions"))} sub="contributions" />
          {showInvestments && <HeroField label="Invested" value={gbp0(sum("investments"))} sub="this year" />}
          <HeroField label="Growth" value={`${now - start >= 0 ? "+" : "−"}${gbp0(Math.abs(now - start))}`} sub="since January" />
        </div>
      </div>
    </section>
  );
}

function HeroField({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums sm:text-lg">{value}</p>
      <p className="truncate text-[11px] text-white/60">{sub}</p>
    </div>
  );
}
