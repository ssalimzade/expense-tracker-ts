import { useRemuneration } from "../../hooks/useRemuneration";
import { QueryState } from "../common";
import { gbp0 } from "../../lib/format";
import { resolvePay, currentRow } from "../../lib/remuneration";
import type { RemunerationRow } from "../../types/remuneration";
import RemunerationTable from "./RemunerationTable";
import { PayGrowthChart } from "./RemunerationCharts";
import TakeHomeCalculator from "./TakeHomeCalculator";
import { BanknotesArt } from "../HeroArt";

export default function RemunerationTab() {
  const query = useRemuneration();
  const rows = query.data ?? [];
  const current = currentRow(rows);

  return (
    <QueryState isLoading={query.isLoading} error={query.error}>
      <div className="mx-auto max-w-7xl space-y-5">
        {current && <PayslipHero rows={rows} current={current} />}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-5">
            {rows.length > 1 && <PayGrowthChart rows={rows} />}
            <RemunerationTable rows={rows} />
          </div>
          <aside className="space-y-4 lg:sticky lg:top-5 lg:self-start">
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

/** Net pay per period, as a small line — the shape of the career at a glance. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 160;
  const h = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 4 - ((v - min) / span) * (h - 8)]);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-40" aria-hidden>
      <polygon points={`0,${h} ${line} ${w},${h}`} className="fill-white/10" />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" className="fill-white" />
    </svg>
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

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 text-white shadow-lg shadow-teal-500/20 dark:from-emerald-700 dark:via-teal-800 dark:to-cyan-900 dark:shadow-none">
      <BanknotesArt className="md:right-72" />

      <div className="relative grid gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div className="min-w-0">
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
            {current.period}
          </span>
          <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Take-home each month</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{gbp0(pay.net_pm)}</p>
          {prev && Math.round(lastRise) !== 0 && (
            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">
              {lastRise > 0 ? "▲" : "▼"} {gbp0(Math.abs(lastRise))}/mo since the last change
            </p>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <HeroField label="Gross + bonus" value={gbp0(current.gross + current.bonus)} sub={`${gbp0(current.gross)} base`} />
            <HeroField label="Net a year" value={gbp0(pay.net_pa)} sub="after tax, NI & pension" />
            <HeroField label="Pension" value={gbp0(Math.abs(pay.pension))} sub={`${Math.round((current.pension_pct ?? 0) * 100)}% of gross`} />
          </div>
        </div>

        <div className="flex items-end justify-between gap-4 border-t border-dashed border-white/25 pt-5 md:flex-col md:items-end md:border-l md:border-t-0 md:pl-7 md:pt-0">
          <div className="md:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">Growth{since ? ` since ${since}` : ""}</p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums">
              {growth >= 0 ? "+" : "−"}
              {Math.abs(growth * 100).toFixed(0)}%
            </p>
            {firstPay && <p className="text-xs text-white/70">from {gbp0(firstPay.net_pm)}/mo</p>}
          </div>
          <Sparkline values={rows.map((r) => resolvePay(r).net_pm)} />
        </div>
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
