import { useState } from "react";
import { useRent } from "../../hooks/useRent";
import { useRemuneration } from "../../hooks/useRemuneration";
import { QueryState } from "../common";
import Hero, { HeroChip } from "../Hero";
import YearSwitch from "../YearSwitch";
import type { RentData, RentMatch } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import { currentNetMonthly } from "../../lib/remuneration";
import { rentIsPaid, rentShare } from "../../lib/rent";
import RentTable from "./RentTable";
import RentPots from "./RentPots";
import { potViews, potsTotal } from "../../lib/pots";
import { CostBreakdownChart, PaidProgressChart } from "./RentCharts";
import { HouseArt } from "../HeroArt";
import PhoneSectionTabs, { usePhoneSection } from "../PhoneSections";

const SECTIONS = [
  { value: "months", label: "Months" },
  { value: "pots", label: "Pots" },
  { value: "charts", label: "Charts" },
] as const;

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
  const section = usePhoneSection("rent-section", SECTIONS);

  return (
    <QueryState isLoading={query.isLoading} error={query.error}>
      {(() => {
        const data: RentData = query.data ?? { items: [], months: {} };
        const reconciled = data.reconciled ?? {};

        const allMonths = [...new Set([...Object.keys(data.months), ...Object.keys(reconciled)])];
        const years = [...new Set(allMonths.map((m) => m.slice(0, 4)))].sort();
        if (years.length === 0) years.push(currentYear);
        const months = allMonths.filter((m) => m.startsWith(year)).sort();
        // Every headline figure reports your share — the bill net of anything a
        // flatmate covers — so the tab answers "what did this cost me".
        const cost = (m: string, k: string) => rentShare(data, m, k);
        const isPaid = (m: string, k: string) => rentIsPaid(data, m, k);

        // Year-to-date only: months up to and including the current month.
        const ytdMonths = months.filter((m) => m <= currentMonth);

        let costYtd = 0;
        let outstanding = 0; // unpaid amounts to date
        for (const m of ytdMonths) {
          for (const it of data.items) {
            const amount = cost(m, it.key);
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
          data.items.some((it) => cost(m, it.key) > 0)
        ).length || 1;

        // Rent-to-salary % for the current month (rent total / current net monthly).
        const remuneration = remQuery.data ?? [];
        const netPm = currentNetMonthly(remuneration);
        const currentRentTotal = data.items.reduce((s, it) => s + cost(currentMonth, it.key), 0);
        const rentToSalary = netPm > 0 ? (currentRentTotal / netPm) * 100 : 0;

        return (
          <div className="mx-auto max-w-7xl space-y-5">
            <YearSwitch years={years} year={year} onChange={setYear} />

            <Hero
              gradient="from-sky-500 via-cyan-600 to-teal-700 dark:from-sky-700 dark:via-cyan-800 dark:to-teal-900"
              badge={`${year} · year to date`}
              label="Rent & bills so far"
              value={gbp0(costYtd)}
              decoration={
                <HouseArt />
              }
              under={
                <HeroChip>
                  {gbp0(costYtd / activeMonths)} a month on average · your share
                </HeroChip>
              }
              fields={[
                {
                  label: "Outstanding",
                  value: gbp0(outstanding),
                  sub: outstanding > 0 ? "not yet paid" : "all settled",
                  warn: outstanding > 0,
                },
                { label: "In bills pots", value: gbp0(setAside), sub: openPots === 1 ? "1 open pot" : `${openPots} open pots` },
                { label: "Rent to salary", value: `${rentToSalary.toFixed(0)}%`, sub: "this month" },
              ]}
            />

            <PhoneSectionTabs sections={SECTIONS} value={section.value} onChange={section.change} />

            <div className={`grid gap-4 lg:grid-cols-2 ${section.show("charts")}`}>
              <CostBreakdownChart data={data} months={months} />
              <PaidProgressChart data={data} months={months} />
            </div>

            <div className={section.show("pots")}>
              <RentPots data={data} upTo={currentMonth} />
            </div>

            <div className={section.show("months")}>
              {months.length > 0 ? (
                <RentTable data={data} months={months} onOpenMatch={onOpenTransactions} />
              ) : (
                <div className="rounded-3xl border-2 border-dashed border-gray-200 p-10 text-center text-sm text-gray-400 dark:border-gray-800">
                  No rent data for {year}.
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </QueryState>
  );
}
