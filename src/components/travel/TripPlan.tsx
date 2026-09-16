import { useState } from "react";
import type { TravelCategory, Trip } from "../../types/travel";
import { CATEGORY_COLORS, planRows, tripDays, type TripSummary } from "../../lib/travel";
import { gbp0 } from "../../lib/format";
import MoneyInput from "../MoneyInput";

/**
 * A mini planner: estimate each category per day or for the whole trip, and
 * watch it against what's actually been spent (your share).
 */
export default function TripPlan({
  trip,
  summary,
  onSaveLine,
  onUseAsBudget,
}: {
  trip: Trip;
  summary: TripSummary;
  onSaveLine: (line: { category: TravelCategory; amount: number; per_day: boolean }) => void;
  onUseAsBudget: (amount: number) => void;
}) {
  const days = tripDays(trip);
  const { rows, planned, spent, expected } = planRows(trip, summary);
  // A per-day/total choice on a row with no amount yet isn't saved (the server
  // keeps only real estimates), so it's held here until an amount goes in.
  const [perDayDraft, setPerDayDraft] = useState<Partial<Record<TravelCategory, boolean>>>({});
  const perDayOf = (r: (typeof rows)[number]) => (r.amount > 0 ? r.per_day : perDayDraft[r.category] ?? r.per_day);
  const roundedExpected = Math.round(expected);

  const seg = (active: boolean) =>
    `rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors ${
      active ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white" : "text-gray-500 dark:text-gray-400"
    }`;

  return (
    <div className="space-y-4">
      {/* Totals */}
      <div className="grid grid-cols-3 gap-2 rounded-3xl bg-white px-5 py-4 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 sm:p-5">
        {[
          { label: "Planned", value: planned, tone: "text-indigo-600 dark:text-indigo-400" },
          { label: "Spent", value: spent, tone: "" },
          { label: "Expected total", value: roundedExpected, tone: "text-gray-500 dark:text-gray-400" },
        ].map((s, i) => (
          // Outer figures hug the edges so the three spread evenly across the card.
          <div key={s.label} className={["text-left", "text-center", "text-right"][i]}>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">{s.label}</p>
            <p className={`mt-1 text-xl font-extrabold tabular-nums tracking-tight sm:text-2xl ${s.tone}`}>{gbp0(s.value)}</p>
          </div>
        ))}
        <p className="col-span-3 mt-1 text-center text-[11px] text-gray-400">
          Expected total = your plan, plus spending in categories you haven't planned or have gone over.
        </p>
        {planned > 0 && roundedExpected !== Math.round(trip.budget) && (
          <button
            onClick={() => onUseAsBudget(roundedExpected)}
            className="col-span-3 justify-self-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300"
          >
            Use {gbp0(roundedExpected)} as the trip budget{trip.budget > 0 ? ` (now ${gbp0(trip.budget)})` : ""}
          </button>
        )}
      </div>

      {!days && (
        <p className="rounded-2xl bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Add trip dates to turn per-day estimates into totals.
        </p>
      )}

      {/* One line per category */}
      <ul className="space-y-2">
        {rows.map((r) => {
          const perDay = perDayOf(r);
          const pct = r.planned > 0 ? Math.min(100, (r.spent / r.planned) * 100) : 0;
          const over = r.planned > 0 && r.spent > r.planned;
          return (
            <li key={r.category} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 sm:px-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[r.category] }} />
                  <span className="truncate text-sm font-semibold">{r.category}</span>
                </span>

                <div className="flex items-center gap-2">
                  <MoneyInput
                    value={r.amount}
                    onCommit={(n) => onSaveLine({ category: r.category, amount: Math.max(0, n), per_day: perDay })}
                    className="!w-20 rounded-lg !border-gray-200 !text-right font-semibold dark:!border-gray-700"
                  />
                  <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-800">
                    {[true, false].map((pd) => (
                      <button
                        key={String(pd)}
                        type="button"
                        onClick={() => {
                          if (pd === perDay) return;
                          if (r.amount > 0) onSaveLine({ category: r.category, amount: r.amount, per_day: pd });
                          else setPerDayDraft((m) => ({ ...m, [r.category]: pd }));
                        }}
                        className={seg(pd === perDay)}
                      >
                        {pd ? "/ day" : "total"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {(r.planned > 0 || r.spent > 0) && (
                <div className="mt-2.5 pl-4">
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className={`h-full rounded-full ${over ? "bg-rose-500" : ""}`}
                      style={{ width: `${r.planned > 0 ? pct : 100}%`, backgroundColor: over ? undefined : CATEGORY_COLORS[r.category], opacity: r.planned > 0 ? 1 : 0.35 }}
                    />
                  </div>
                  <p className="mt-1 flex justify-between text-[11px] tabular-nums text-gray-400">
                    <span>
                      {gbp0(r.spent)} spent
                      {r.planned > 0 && <> of {gbp0(r.planned)}</>}
                      {r.planned === 0 && " · not planned"}
                    </span>
                    {r.planned > 0 && perDay && days > 0 && (
                      <span>
                        {gbp0(r.amount)} × {days} days
                      </span>
                    )}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
