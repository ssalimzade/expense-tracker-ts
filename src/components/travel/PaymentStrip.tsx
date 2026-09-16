import type { Trip, TripExpense } from "../../types/travel";
import type { Repayment } from "../../types/repayment";
import { flexSchedule, type TripSummary } from "../../lib/travel";

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });

/** How the trip was paid: card now vs Flex later, with Flex repayments by month. */
export default function PaymentStrip({
  trip,
  expenses,
  summary,
  repayments,
  money,
}: {
  trip: Trip;
  expenses: TripExpense[];
  summary: TripSummary;
  /** Repayments, for the Flex schedule; undefined while loading. */
  repayments: Repayment[] | undefined;
  money: (gbp: number) => string;
}) {
  const { card, flex } = summary.byPayment;
  const total = card + flex;
  if (flex < 0.5) return null; // All card — nothing to break down.
  const { months, unscheduled } = flexSchedule(trip, expenses, repayments ?? []);

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">How you paid</p>
      <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full">
        <span className="h-full rounded-l-full bg-sky-500" style={{ width: `${(card / total) * 100}%` }} />
        <span className="h-full rounded-r-full bg-[#b3a089]" style={{ width: `${(flex / total) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
          <span className="flex-1 text-gray-600 dark:text-gray-300">Card — paid now</span>
          <span className="font-semibold tabular-nums">{money(card)}</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#b3a089]" />
          <span className="flex-1 text-gray-600 dark:text-gray-300">Flex — paid over months</span>
          <span className="font-semibold tabular-nums">{money(flex)}</span>
        </li>
      </ul>

      {(months.length > 0 || unscheduled >= 0.5) && (
        <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Flex repayments</p>
          {!repayments ? (
            <p className="mt-2 text-xs text-gray-400">Loading schedule…</p>
          ) : (
            <ul className="mt-2 space-y-1 text-xs">
              {months.map((m) => (
                <li key={m.month} className="flex justify-between tabular-nums">
                  <span className="text-gray-500 dark:text-gray-400">{monthLabel(m.month)}</span>
                  <span className="font-semibold">{money(m.amount)}</span>
                </li>
              ))}
              {unscheduled >= 0.5 && (
                <li className="flex justify-between tabular-nums" title="Entered by hand, or no longer in Repayments">
                  <span className="text-gray-400">No schedule</span>
                  <span className="font-semibold">{money(unscheduled)}</span>
                </li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
