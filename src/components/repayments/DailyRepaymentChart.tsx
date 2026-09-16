import { useState } from "react";
import type { Repayment } from "../../types/repayment";
import { dailyUpcoming, dailyUpcomingCats, repaymentsOnDate, catColor } from "../../lib/repayments";
import { gbp } from "../../lib/format";
import ChartLegend from "../ChartLegend";
import { Card } from "../common";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

interface Props {
  repayments: Repayment[];
  visibleMonths: string[];
}

export default function DailyRepaymentChart({ repayments, visibleMonths }: Props) {
  const raw = dailyUpcoming(repayments, visibleMonths);
  const cats = dailyUpcomingCats(repayments, visibleMonths);
  const today = new Date().toISOString().slice(0, 10);

  const [selected, setSelected] = useState<string | null>(null);
  const dueItems = selected ? repaymentsOnDate(repayments, selected) : [];
  const dueTotal = dueItems.reduce((s, i) => s + i.amount, 0);

  // Ephemeral "ticked" rows in the popup — visual scratchpad, not persisted.
  const [tickedItems, setTickedItems] = useState<Set<string>>(new Set());
  const toggleItem = (key: string) =>
    setTickedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (raw.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-400">No upcoming repayments in this period</p>
      </Card>
    );
  }

  const grandTotal = raw.reduce((s, d) => s + d.total, 0);
  const peak = Math.max(1, ...raw.map((d) => d.total));
  const countOn = (date: string) => repaymentsOnDate(repayments, date).length;

  return (
    <Card>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
            Upcoming Repayments
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">Tap a date to see what's due</p>
        </div>
        <span className="text-2xl font-bold tabular-nums tracking-tight text-gray-900 dark:text-white">
          {gbp(grandTotal)}
        </span>
      </div>
      <ChartLegend className="mb-4" items={cats.map((c) => ({ label: c, color: catColor(c) }))} />

      <ul className="space-y-1">
        {raw.map((d) => {
          const past = d.date < today;
          const [y, m, day] = d.date.split("-").map(Number);
          const label = new Date(y, m - 1, day).toLocaleString("en-GB", { day: "numeric", month: "short" });
          const n = countOn(d.date);
          return (
            <li key={d.date}>
              <button
                type="button"
                onClick={() => setSelected(d.date)}
                className={`grid w-full grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-gray-50 active:bg-gray-100 dark:hover:bg-gray-800/50 dark:active:bg-gray-800 sm:grid-cols-[5rem_minmax(0,1fr)_auto] ${
                  past ? "opacity-50" : ""
                }`}
              >
                <span>
                  <span className="block text-sm font-bold text-gray-900 dark:text-white">{label}</span>
                  <span className="block text-[11px] text-gray-400">
                    {d.date === today ? "today" : `${n} item${n === 1 ? "" : "s"}`}
                  </span>
                </span>
                <span className="flex h-3 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <span className="flex h-full" style={{ width: `${(d.total / peak) * 100}%` }}>
                    {cats
                      .filter((c) => (d.byCategory[c] ?? 0) > 0)
                      .map((c) => (
                        <span
                          key={c}
                          title={`${c} ${gbp(d.byCategory[c])}`}
                          className="h-full"
                          style={{ width: `${(d.byCategory[c] / d.total) * 100}%`, backgroundColor: catColor(c) }}
                        />
                      ))}
                  </span>
                </span>
                <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                  {gbp(d.total)}
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600">
                    <path fillRule="evenodd" d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                  </svg>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Due {fmtDate(selected)}
                </h3>
                <p className="text-xs text-gray-400">{dueItems.length} repayment{dueItems.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto dark:divide-gray-800/60">
              {dueItems.map((item, i) => {
                const key = `${item.id}-${i}`;
                const isTicked = tickedItems.has(key);
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2.5 ${
                      isTicked ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(key)}
                      title={isTicked ? "Untick" : "Tick"}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isTicked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
                      }`}
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                        <path d="M2.5 6.2 4.7 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{item.description}</p>
                      <p className="text-xs text-gray-400">{item.category}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {gbp(item.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total</span>
              <span className="text-base font-bold tabular-nums text-gray-900 dark:text-white">{gbp(dueTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
