import { useState } from "react";
import { useRepayments, useDeleteRepayment, useRestoreRepayment } from "../../hooks/useRepayments";
import { QueryState, Card } from "../common";
import RepaymentTable from "./RepaymentTable";
import RepaymentPivot from "./RepaymentPivot";
import DailyRepaymentChart from "./DailyRepaymentChart";
import SyntheticRepaymentsPanel from "./SyntheticRepaymentsPanel";
import { filterActiveRepayments, pivot, visibleRepaymentMonths } from "../../lib/repayments";
import { useTouchDismiss } from "../../hooks/useTouchDismiss";
import { gbp0, formatMonthLabel } from "../../lib/format";
import Hero from "../Hero";
import { CardArt, IN_COLUMN } from "../HeroArt";
import type { Repayment } from "../../types/repayment";
import PhoneSectionTabs, { usePhoneSection } from "../PhoneSections";

const SECTIONS = [
  { value: "due", label: "Due dates" },
  { value: "schedule", label: "Schedule" },
  { value: "monzo", label: "Pushed to Monzo" },
] as const;

export default function RepaymentsTab() {
  const repaymentsQuery = useRepayments();
  const del = useDeleteRepayment();
  const restore = useRestoreRepayment();
  const months = visibleRepaymentMonths();
  const section = usePhoneSection("repayments-section", SECTIONS, true);

  // Undo list: keeps recently-deleted repayments so the user can restore them
  const [deleted, setDeleted] = useState<{ id: string; description: string }[]>([]);

  const handleDelete = (r: Repayment) => {
    del.mutate(r.id, {
      onSuccess: () => {
        setDeleted((prev) => [...prev, { id: r.id, description: r.description }]);
      },
    });
  };

  const handleRestore = (id: string) => {
    restore.mutate(id, {
      onSuccess: () => {
        setDeleted((prev) => prev.filter((d) => d.id !== id));
      },
    });
  };

  return (
    <QueryState isLoading={repaymentsQuery.isLoading} error={repaymentsQuery.error}>
      {(() => {
        const allRepayments = repaymentsQuery.data ?? [];
        const active = filterActiveRepayments(allRepayments, months);
        // Same totals as the breakdown below: Uncategorized is left out.
        const { rows: pivotRows } = pivot(active, months);
        const monthTotal = (m: string) =>
          pivotRows.reduce((t, r) => (r.category === "Uncategorized" ? t : t + (r.values[m] ?? 0)), 0);
        const totals = months.map((m) => ({ month: m, total: monthTotal(m) }));
        const grand = totals.reduce((t, x) => t + x.total, 0);
        const peak = Math.max(1, ...totals.map((x) => x.total));
        const monthName = (m: string) => formatMonthLabel(m).split(" ")[0];
        const next = totals.find((x) => x.total > 0);
        const busiest = totals.reduce((a, b) => (b.total > a.total ? b : a), totals[0]);

        return (
          <div className="mx-auto max-w-7xl space-y-5">
            <Hero
              gradient="from-[#8c7c68] via-[#6b5d4d] to-[#3f362e]"
              badge={`${formatMonthLabel(months[0])} – ${formatMonthLabel(months[months.length - 1])}`}
              label="Flex still to repay"
              decoration={<CardArt className={IN_COLUMN} />}
              value={gbp0(grand)}
              fields={[
                next
                  ? { label: "Next payment", value: gbp0(next.total), sub: `due 1 ${monthName(next.month)}` }
                  : { label: "Next payment", value: "—", sub: "nothing due" },
                { label: "Busiest month", value: gbp0(busiest.total), sub: monthName(busiest.month) },
                { label: "Purchases", value: String(active.length), sub: "still being repaid" },
              ]}
              aside={
                <MonthBars
                  totals={totals}
                  peak={peak}
                  monthName={monthName}
                />
              }
            />

            <PhoneSectionTabs sections={SECTIONS} value={section.value} onChange={section.change} allWidths />

            <div className={`grid gap-5 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:items-start ${section.show("due")}`}>
              <DailyRepaymentChart repayments={active} visibleMonths={months} />
              <RepaymentPivot repayments={active} visibleMonths={months} />
            </div>
            <div className={section.show("schedule")}>
              <RepaymentTable repayments={active} onDelete={handleDelete} />
            </div>
            <div className={section.show("monzo")}>
              <SyntheticRepaymentsPanel visibleMonths={months} />
            </div>

            {/* Undo list */}
            {deleted.length > 0 && (
              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    {deleted.length} deleted — undo?
                  </span>
                  <button
                    onClick={() => setDeleted([])}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Clear
                  </button>
                </div>
                <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {deleted.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-500 dark:text-gray-400">{d.description}</span>
                      <button
                        onClick={() => handleRestore(d.id)}
                        className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-700 dark:text-gray-300"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        );
      })()}
    </QueryState>
  );
}

/**
 * The header's month bars. Hovering (or tapping) a bar shows that month's total
 * and when it's due.
 */
function MonthBars({
  totals,
  peak,
  monthName,
}: {
  totals: { month: string; total: number }[];
  peak: number;
  monthName: (m: string) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  // On a phone the tooltip has no "moved away" to close it, so a tap elsewhere does.
  const { ref } = useTouchDismiss<HTMLDivElement>(() => setActive(null));
  return (
    <div ref={ref} className="relative flex h-28 items-end gap-3" onMouseLeave={() => setActive(null)}>
      {totals.map((x, i) => {
        const on = active === x.month;
        return (
          <button
            key={x.month}
            type="button"
            onMouseEnter={() => setActive(x.month)}
            onFocus={() => setActive(x.month)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(on ? null : x.month)}
            className="group relative flex w-16 flex-col items-center gap-1 focus:outline-none"
          >
            <span className="text-[11px] font-bold tabular-nums">{gbp0(x.total)}</span>
            <span
              className={`block w-12 rounded-t-lg transition-colors ${on ? "bg-white" : "bg-white/75 group-hover:bg-white"}`}
              style={{ height: `${Math.max(4, (x.total / peak) * 64)}px` }}
            />
            <span className={`text-[11px] font-semibold ${on ? "text-white" : "text-white/75"}`}>{monthName(x.month)}</span>
            {on && (
              <span
                // Above the bar on phones; beside it on wider screens, where the
                // header is too short to fit it above without clipping.
                className={`absolute z-20 w-max rounded-xl bg-gray-950/85 px-3 py-2 text-left backdrop-blur text-xs text-gray-300 shadow-xl ring-1 ring-white/10 max-md:bottom-full max-md:mb-2 md:bottom-0 md:right-full md:mr-2 ${
                  i >= totals.length - 2 ? "max-md:right-0" : "max-md:left-0"
                }`}
              >
                <span className="block text-gray-400">Due 1 {formatMonthLabel(x.month)}</span>
                <span className="block text-sm font-bold tabular-nums text-white">{gbp0(x.total)}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
