import { useState } from "react";
import { useRent } from "../../hooks/useRent";
import { useRemuneration } from "../../hooks/useRemuneration";
import { QueryState } from "../common";
import type { RentData, RentLineItem, RentMatch } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import RentTable from "./RentTable";
import RentPots from "./RentPots";
import { potViews, potsTotal } from "../../lib/pots";
import { CostBreakdownChart, PaidProgressChart } from "./RentCharts";

const blank: RentLineItem = { amount: 0, paid: false };

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

interface Props {
  onOpenTransactions?: (match: RentMatch) => void;
}

export default function RentTab({ onOpenTransactions }: Props) {
  const query = useRent();
  const remQuery = useRemuneration();
  const currentYear = String(new Date().getFullYear());
  const [year, setYear] = useState(currentYear);

  return (
    <QueryState isLoading={query.isLoading} error={query.error}>
      {(() => {
        const data: RentData = query.data ?? { items: [], months: {} };
        const reconciled = data.reconciled ?? {};

        const allMonths = [...new Set([...Object.keys(data.months), ...Object.keys(reconciled)])];
        const years = [...new Set(allMonths.map((m) => m.slice(0, 4)))].sort();
        if (years.length === 0) years.push(currentYear);
        const months = allMonths.filter((m) => m.startsWith(year)).sort();
        const cell = (m: string, k: string): RentLineItem => data.months[m]?.[k] ?? blank;
        const matchedAmount = (m: string, k: string) => reconciled[m]?.[k]?.amount ?? cell(m, k).amount;
        // Effective paid = manually ticked OR a matching transaction exists.
        const isPaid = (m: string, k: string) => cell(m, k).paid || !!reconciled[m]?.[k];

        // Year-to-date only: months up to and including the current month.
        const ytdMonths = months.filter((m) => m <= currentMonth);

        let costYtd = 0;
        let outstanding = 0; // unpaid amounts to date
        for (const m of ytdMonths) {
          for (const it of data.items) {
            const amount = matchedAmount(m, it.key);
            costYtd += amount;
            if (!isPaid(m, it.key)) outstanding += amount;
          }
        }

        // Set aside is a live balance, not a running total: it counts what is
        // sitting in the pots right now, across all time, so a pot that has been
        // settled into savings stops being counted.
        const pots = potViews(data, currentMonth);
        const setAside = potsTotal(pots);
        const openPots = pots.filter((p) => !p.closed).length;
        const activeMonths = ytdMonths.filter((m) =>
          data.items.some((it) => matchedAmount(m, it.key) > 0)
        ).length || 1;

        // Rent-to-salary % for the current month (rent total / current net monthly).
        const remuneration = remQuery.data ?? [];
        const netPm = (remuneration.find((r) => r.current) ?? remuneration[remuneration.length - 1])?.net_pm ?? 0;
        const currentRentTotal = data.items.reduce((s, it) => s + matchedAmount(currentMonth, it.key), 0);
        const rentToSalary = netPm > 0 ? (currentRentTotal / netPm) * 100 : 0;

        const stats = [
          { label: "Cost YTD", short: "Cost YTD", value: gbp0(costYtd), sub: `${gbp0(costYtd / activeMonths)}/mo avg`, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/60 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900" },
          { label: "In Savings Pots", short: "In Pots", value: gbp0(setAside), sub: openPots === 1 ? "1 open pot" : `${openPots} open pots`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/60 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900" },
          { label: "Outstanding (to date)", short: "Outstanding", value: gbp0(outstanding), sub: outstanding > 0 ? "not yet paid" : "all settled", color: outstanding > 0 ? "text-red-600 dark:text-red-400" : "text-teal-600 dark:text-teal-400", bg: "bg-rose-50/60 border-rose-100 dark:bg-rose-950/30 dark:border-rose-900" },
          { label: "Rent to Salary", short: "Rent/Salary", value: `${rentToSalary.toFixed(0)}%`, sub: "current month", color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50/60 border-sky-100 dark:bg-sky-950/30 dark:border-sky-900" },
        ];

        return (
          <div className="space-y-4">
            {/* Year tabs */}
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

            {/* Summary cards */}
            <div className="grid gap-2 grid-cols-4 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label} className={`rounded-2xl border px-1.5 py-2 text-center sm:px-5 sm:py-4 ${s.bg}`}>
                  <p className="text-[9px] font-medium uppercase leading-tight tracking-wide text-gray-500 sm:text-xs sm:tracking-wider">
                    <span className="sm:hidden">{s.short}</span>
                    <span className="hidden sm:inline">{s.label}</span>
                  </p>
                  <p className={`mt-1 text-sm font-bold sm:mt-1.5 sm:text-2xl ${s.color}`}>{s.value}</p>
                  <p className="mt-0.5 hidden truncate text-xs text-gray-400 sm:block">{s.sub}</p>
                </div>
              ))}
            </div>

            <RentPots data={data} upTo={currentMonth} />

            <div className="grid gap-4 lg:grid-cols-2">
              <CostBreakdownChart data={data} months={months} />
              <PaidProgressChart data={data} months={months} />
            </div>

            {months.length > 0 ? (
              <RentTable data={data} months={months} onOpenMatch={onOpenTransactions} />
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400 dark:border-gray-700">
                No rent data for {year}.
              </div>
            )}
          </div>
        );
      })()}
    </QueryState>
  );
}
