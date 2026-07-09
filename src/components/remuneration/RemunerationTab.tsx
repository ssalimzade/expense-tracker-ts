import { useRemuneration } from "../../hooks/useRemuneration";
import { QueryState } from "../common";
import { gbp0 } from "../../lib/format";
import RemunerationTable from "./RemunerationTable";
import { PayGrowthChart } from "./RemunerationCharts";
import TakeHomeCalculator from "./TakeHomeCalculator";

export default function RemunerationTab() {
  const query = useRemuneration();

  return (
    <QueryState isLoading={query.isLoading} error={query.error}>
      {(() => {
        const rows = query.data ?? [];
        const current = rows.find((r) => r.current) ?? rows[rows.length - 1];
        const first = rows[0];

        const totalGrowthPct =
          first && current && first.net_pm ? (current.net_pm - first.net_pm) / first.net_pm : 0;

        const stats = current
          ? [
              { label: "Current Net p.m", short: "Net p.m", value: gbp0(current.net_pm), sub: current.period, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50/60 border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900" },
              { label: "Gross + Bonus", short: "Gross+Bonus", value: gbp0(current.gross + current.bonus), sub: `${gbp0(current.gross)} base`, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-50/60 border-sky-100 dark:bg-sky-950/30 dark:border-sky-900" },
              { label: "Net p.a", short: "Net p.a", value: gbp0(current.net_pa), sub: "after tax, NI & pension", color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50/60 border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900" },
              { label: "Growth since start", short: "Growth", value: `+${(totalGrowthPct * 100).toFixed(0)}%`, sub: first ? `from ${gbp0(first.net_pm)}/mo` : "", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/60 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900" },
            ]
          : [];

        return (
          <div className="space-y-4">
            {stats.length > 0 && (
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
            )}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PayGrowthChart rows={rows} />
              </div>
              <TakeHomeCalculator
                defaultAnnual={current?.gross ?? 71500}
                currentNetMonthly={current?.net_pm}
              />
            </div>

            <RemunerationTable rows={rows} />
          </div>
        );
      })()}
    </QueryState>
  );
}
