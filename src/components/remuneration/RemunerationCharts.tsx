import type { ReactNode } from "react";
import type { RemunerationRow } from "../../types/remuneration";
import { resolvePay } from "../../lib/remuneration";
import { HeroChartHeader, HeroLineChart } from "../HeroCharts";

const VIEWS = {
  net: { label: "Take-home a month", color: "#10b981" },
  gross: { label: "Gross a year", color: "#14b8a6" },
} as const;
export type PayView = keyof typeof VIEWS;
type View = PayView;

const money = (v: number) => `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

const payData = (rows: RemunerationRow[]) =>
  rows.map((r) => ({
    start: r.period.split(" - ")[0].trim(),
    full: r.period,
    net: Math.round(resolvePay(r).net_pm),
    gross: r.gross,
  }));

function ViewToggle({ view, onChange, onGradient }: { view: View; onChange: (v: View) => void; onGradient?: boolean }) {
  return (
    <div className={`flex gap-1 rounded-xl p-0.5 ${onGradient ? "bg-white/15" : "bg-gray-100 dark:bg-gray-800/70"}`}>
      {(Object.keys(VIEWS) as View[]).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
            v === view
              ? onGradient
                ? "bg-white text-gray-900 shadow-sm"
                : "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
              : onGradient
                ? "text-white/75 hover:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
          }`}
        >
          {VIEWS[v].label}
        </button>
      ))}
    </div>
  );
}

/**
 * The Salary header's minimal pay line, with the same take-home / gross switch.
 * The header mounts it twice (phone and wide layouts), so the chosen view is the
 * caller's state — otherwise the two copies would disagree.
 */
export function PayHeroChart({
  rows,
  note,
  view,
  onView,
  className = "h-32",
}: {
  rows: RemunerationRow[];
  note?: ReactNode;
  view: PayView;
  onView: (v: PayView) => void;
  className?: string;
}) {
  return (
    <div>
      <HeroChartHeader title="Pay over time" note={note} right={<ViewToggle view={view} onChange={onView} onGradient />} />
      <HeroLineChart
        key={view}
        className={className}
        data={payData(rows)}
        labelKey="start"
        tipTitleKey="full"
        format={money}
        series={[{ key: view, label: VIEWS[view].label, kind: "area" }]}
      />
    </div>
  );
}
