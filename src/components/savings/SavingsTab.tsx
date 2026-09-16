import { useState } from "react";
import { useSavings } from "../../hooks/useSavings";
import { QueryState } from "../common";
import SavingsTable from "./SavingsTable";
import { SavingsGrowthChart } from "./SavingsCharts";
import { HeroChartHeader, HeroLineChart } from "../HeroCharts";
import { gbp0 } from "../../lib/format";
import type { SavingsRow } from "../../types/savings";
import { PiggyBankArt, IN_COLUMN } from "../HeroArt";
import PhoneSectionTabs, { usePhoneSection } from "../PhoneSections";

const SECTIONS = [
  { value: "months", label: "Months" },
  { value: "charts", label: "Balance chart" },
] as const;

const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const monthName = (iso: string) => new Date(iso).toLocaleString("en-GB", { month: "long" });

export default function SavingsTab() {
  const savingsQuery = useSavings();
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);
  const section = usePhoneSection("savings-section", SECTIONS);

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
          <span className="flex items-center gap-1.5 rounded-full bg-[#c8b58f]/20 px-3 py-1 text-xs font-medium text-[#7d6540] dark:bg-[#c8b58f]/10 dark:text-[#d2bc92]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#c8b58f]" />
            Wyndham deposit £1,900 — kept separate from this balance
          </span>
        </div>

        {rows.length > 0 && <VaultHero rows={rows} year={year} showInvestments={showInvestments} />}

        <PhoneSectionTabs sections={SECTIONS} value={section.value} onChange={section.change} />

        {/* Wide screens show the balance chart inside the header. */}
        <div className={`lg:hidden ${section.show("charts")}`}>
          <SavingsGrowthChart rows={rows} />
        </div>

        <div className={section.show("months")}>
          <SavingsTable
            rows={rows}
            showInvestments={showInvestments}
            seedDate={allRows.reduce((min, r) => (!min || r.start_date < min ? r.start_date : min), "")}
          />
        </div>
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
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6f8a58] via-[#526a44] to-[#34472f] text-white shadow-lg shadow-black/10 dark:shadow-none">
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
        <div className="relative min-w-0">
        <PiggyBankArt className={IN_COLUMN} />
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
          <HeroField label="Saved this year" value={gbp0(totalSaved)} sub={`average ${gbp0(avgPerMonth)} a month`} />
          <HeroField label="Home" value={gbp0(sum("home_contributions"))} sub="contributions" />
          {showInvestments && <HeroField label="Invested" value={gbp0(sum("investments"))} sub="this year" />}
          <HeroField label="Growth" value={`${now - start >= 0 ? "+" : "−"}${gbp0(Math.abs(now - start))}`} sub="since January" />
        </div>
        </div>
        <div className="hidden border-dashed border-white/25 lg:block lg:border-l lg:pl-7">
          <div className="w-[26rem] xl:w-[32rem]">
            <HeroChartHeader title="Balance through the year" note={`${gbp0(yearEnd)} by ${monthName(rows[rows.length - 1].start_date)}`} />
            <HeroLineChart
              className="h-32"
              labelKey="label"
              tipTitleKey="title"
              format={gbp0}
              series={[
                { key: "actual", label: "Balance", kind: "area" },
                { key: "future", label: "Expected", kind: "dashed" },
              ]}
              data={rows.map((r) => {
                const key = r.start_date.slice(0, 7);
                return {
                  label: monthName(r.start_date),
                  title: `${monthName(r.start_date)} ${year}`,
                  actual: key <= currentKey ? r.ending_balance : null,
                  future: key >= currentKey ? r.ending_balance : null,
                };
              })}
            />
          </div>
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
