import { useState } from "react";
import { useRemuneration } from "../../hooks/useRemuneration";
import { QueryState } from "../common";
import { gbp0 } from "../../lib/format";
import { resolvePay, currentRow } from "../../lib/remuneration";
import type { RemunerationRow } from "../../types/remuneration";
import RemunerationTable from "./RemunerationTable";
import { PayHeroChart, type PayView } from "./RemunerationCharts";
import TakeHomeCalculator from "./TakeHomeCalculator";
import { BanknotesArt, IN_COLUMN } from "../HeroArt";
import PhoneSectionTabs, { usePhoneSection } from "../PhoneSections";

const SECTIONS = [
  { value: "career", label: "Career" },
  { value: "whatif", label: "Calculator" },
] as const;

export default function RemunerationTab() {
  const query = useRemuneration();
  const rows = query.data ?? [];
  const current = currentRow(rows);
  const section = usePhoneSection("salary-section", SECTIONS);

  return (
    <QueryState isLoading={query.isLoading} error={query.error}>
      <div className="mx-auto max-w-7xl space-y-5">
        {current && <PayslipHero rows={rows} current={current} />}

        <PhoneSectionTabs sections={SECTIONS} value={section.value} onChange={section.change} />

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className={`min-w-0 lg:space-y-5 ${section.value === "whatif" ? "max-lg:hidden" : ""}`}>
            <div className={section.show("career")}>
              <RemunerationTable rows={rows} />
            </div>
          </div>
          <aside className={`space-y-4 lg:sticky lg:top-5 lg:self-start ${section.show("whatif")}`}>
            <TakeHomeCalculator
              defaultAnnual={current?.gross ?? 71500}
              currentNetMonthly={current ? resolvePay(current).net_pm : undefined}
            />
          </aside>
        </div>
      </div>
    </QueryState>
  );
}

function PayslipHero({ rows, current }: { rows: RemunerationRow[]; current: RemunerationRow }) {
  const pay = resolvePay(current);
  const first = rows[0];
  const firstPay = first ? resolvePay(first) : null;
  const growth = firstPay && firstPay.net_pm ? (pay.net_pm - firstPay.net_pm) / firstPay.net_pm : 0;
  const prev = rows[rows.length - 2];
  const lastRise = prev ? pay.net_pm - resolvePay(prev).net_pm : 0;
  const since = first?.period.split(" - ")[0];
  // Shared by the two copies of the chart below, so switching view on one width
  // survives a resize to the other.
  const [payView, setPayView] = useState<PayView>("net");
  const growthNote = (
    <>
      {growth >= 0 ? "+" : "−"}
      {Math.abs(growth * 100).toFixed(0)}% since {since}
    </>
  );

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-500/20 dark:from-emerald-700 dark:via-teal-800 dark:to-cyan-900 dark:shadow-none">
      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-stretch">
        <div className="relative min-w-0">
          <BanknotesArt className={IN_COLUMN} />
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
            {current.period}
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Take-home each month</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{gbp0(pay.net_pm)}</p>
          {prev && Math.round(lastRise) !== 0 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              {lastRise > 0 ? "▲" : "▼"} {gbp0(Math.abs(lastRise))} a month {lastRise > 0 ? "more" : "less"} since the last change
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <HeroField label="Gross + bonus" value={gbp0(current.gross + current.bonus)} sub={`${gbp0(current.gross)} base`} />
            <HeroField label="Net a year" value={gbp0(pay.net_pa)} sub="after tax, NI & pension" />
            <HeroField label="Pension" value={gbp0(Math.abs(pay.pension))} sub={`${Math.round((current.pension_pct ?? 0) * 100)}% of gross`} />
          </div>

          {/* Phones get the same chart, under the figures rather than beside them. */}
          {rows.length > 1 && (
            <div className="mt-6 border-t border-dashed border-white/25 pt-5 lg:hidden">
              <PayHeroChart rows={rows} note={growthNote} view={payView} onView={setPayView} className="h-24" />
            </div>
          )}
        </div>

        {rows.length > 1 && (
          <div className="hidden border-dashed border-white/25 lg:block lg:border-l lg:pl-7">
            <div className="w-[26rem] xl:w-[32rem]">
              <PayHeroChart rows={rows} note={growthNote} view={payView} onView={setPayView} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function HeroField({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular-nums">{value}</p>
      <p className="truncate text-[11px] text-white/60">{sub}</p>
    </div>
  );
}
