import { useState } from "react";
import { useSaveRemunerationRow, useDeleteRemunerationRow } from "../../hooks/useRemuneration";
import type { RemunerationRow, RemunerationDerived } from "../../types/remuneration";
import { resolvePay, isPinned } from "../../lib/remuneration";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import { toast } from "../../lib/toast";
import MoneyInput from "../MoneyInput";

const currentYear = String(new Date().getFullYear());

const DERIVED: [RemunerationDerived, string][] = [
  ["pension", "Pension"],
  ["deductions", "Tax, NI & benefits"],
  ["net_pa", "Net a year"],
  ["net_pm", "Net a month"],
];

/** "Feb 2026 - Jan 2027" → "'26" — the year the period starts in. */
const yearMark = (period: string) => {
  const y = period.match(/\d{4}/)?.[0];
  return y ? `’${y.slice(2)}` : "•";
};

interface Props {
  rows: RemunerationRow[];
}

/** Salary history as a career timeline: newest first, each change a stop along the way. */
export default function RemunerationTable({ rows }: Props) {
  const save = useSaveRemunerationRow();
  const del = useDeleteRemunerationRow();
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (period: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(period)) next.delete(period);
      else next.add(period);
      return next;
    });

  const commit = (row: RemunerationRow, patch: Partial<RemunerationRow>, originalPeriod?: string) =>
    save.mutate({ row: { ...row, ...patch }, originalPeriod: originalPeriod ?? row.period });

  const rename = (row: RemunerationRow, period: string) => {
    const next = period.trim();
    if (!next || next === row.period) return;
    commit(row, { period: next }, row.period);
  };

  /**
   * Derived fields double as overrides. Clearing the field — or retyping the
   * calculated figure — hands it back to the calculation; anything else pins it.
   * None of these is ever legitimately zero on a real salary, so an empty field
   * reads as "recalculate", matching how diff in bills behaves.
   */
  const commitDerived = (row: RemunerationRow, field: RemunerationDerived, value: number) => {
    const auto = resolvePay({ ...row, [field]: null })[field];
    const pin = value !== 0 && Math.round(value) !== Math.round(auto);
    commit(row, { [field]: pin ? value : null });
  };

  /** Delete, offering the row straight back at the position it came from. */
  const remove = (row: RemunerationRow) => {
    const index = rows.findIndex((r) => r.period === row.period);
    del.mutate(row.period, {
      onSuccess: () => toast.undo(`Removed ${row.period}`, () => save.mutate({ row, index })),
    });
  };

  const addUpdate = () => {
    const last = rows[rows.length - 1];
    save.mutate({
      row: {
        period: `New update ${currentYear}`,
        gross: last?.gross ?? 0,
        bonus: last?.bonus ?? 0,
        pension_pct: last?.pension_pct ?? 0.04,
        current: true, // the newest salary is the one you're on
        pension: null,
        deductions: null,
        net_pa: null,
        net_pm: null,
      },
    });
  };

  // Most recent salary first; Δ still compares against the previous period.
  const displayRows = rows
    .map((row, i) => {
      const prev = rows[i - 1];
      const pay = resolvePay(row);
      const prevPm = prev ? resolvePay(prev).net_pm : 0;
      return {
        row,
        pay,
        isCurrent: i === rows.length - 1, // newest row is always the current one
        hasPrev: !!prev,
        deltaAbs: prev ? pay.net_pm - prevPm : 0,
        deltaPct: prev && prevPm ? (pay.net_pm - prevPm) / prevPm : 0,
      };
    })
    .reverse();

  const inputCls =
    "!w-24 rounded-lg !border-gray-200 !text-right font-semibold dark:!border-gray-700 max-md:!w-[5.5rem]";

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Salary history</h2>
          <p className="text-xs text-gray-400">Enter gross and bonus — the rest is calculated</p>
        </div>
        <button
          onClick={addUpdate}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
        >
          <span className="text-lg leading-none">+</span> Pay change
        </button>
      </div>

      <ol className="relative">
        <span
          className="absolute bottom-6 left-[1.125rem] top-6 w-px bg-gradient-to-b from-emerald-400 via-teal-300/60 to-transparent dark:from-emerald-600 dark:via-teal-800 sm:left-[1.375rem]"
          aria-hidden
        />
        {displayRows.map(({ row, pay, isCurrent, hasPrev, deltaAbs, deltaPct }, i) => {
          const expanded = open.has(row.period);
          return (
            <li key={`${row.period}-${i}`} className="group relative pb-4 pl-11 last:pb-0 sm:pl-14">
              <span
                className={`absolute left-0 top-3 flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-extrabold shadow-sm sm:h-11 sm:w-11 ${
                  isCurrent
                    ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white"
                    : "border border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                }`}
              >
                {yearMark(row.period)}
              </span>

              <div
                className={`rounded-2xl bg-white ring-1 transition dark:bg-gray-900 ${
                  isCurrent ? "ring-emerald-300/70 dark:ring-emerald-800" : "ring-gray-100 dark:ring-gray-800"
                }`}
              >
                <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-3 pt-3 sm:px-4">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      defaultValue={row.period}
                      onBlur={(e) => rename(row, e.target.value)}
                      onKeyDown={commitOnEnter(row.period)}
                      aria-label="Period"
                      className="-ml-1 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-base font-bold tracking-tight focus:border-gray-200 focus:outline-none dark:focus:border-gray-700"
                    />
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                        Now
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold tabular-nums tracking-tight">
                      {gbp0(pay.net_pm)}
                      <span className="text-xs font-medium text-gray-400">/mo</span>
                    </p>
                    {hasPrev && (
                      <p
                        className={`text-xs font-semibold tabular-nums ${
                          deltaAbs >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                        }`}
                      >
                        {deltaAbs >= 0 ? "+" : "−"}
                        {gbp0(Math.abs(deltaAbs))}{" "}
                        <span className="text-gray-400">
                          ({deltaAbs >= 0 ? "+" : ""}
                          {(deltaPct * 100).toFixed(1)}%)
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 px-3 pb-3 text-xs sm:px-4">
                  <label className="flex items-center gap-2">
                    <span className="text-gray-400">Gross</span>
                    <MoneyInput value={row.gross} onCommit={(n) => commit(row, { gross: n })} pound className={inputCls} />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-400">Bonus</span>
                    <MoneyInput value={row.bonus} onCommit={(n) => commit(row, { bonus: n })} pound className={inputCls} />
                  </label>
                  <button
                    type="button"
                    onClick={() => toggle(row.period)}
                    aria-expanded={expanded}
                    className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    Breakdown
                    <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 transition ${expanded ? "rotate-180" : ""}`}>
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>

                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50/70 px-3 py-3 dark:border-gray-800 dark:bg-gray-950/30 sm:px-4">
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2">
                      {DERIVED.map(([field, label]) => {
                        return (
                          <label
                            key={field}
                            className="flex items-center justify-between gap-2"
                            title={
                              isPinned(row, field)
                                ? "Entered by hand — clear it to go back to the calculated value"
                                : "Calculated from gross pay"
                            }
                          >
                            <span className="text-gray-500 dark:text-gray-400">{label}</span>
                            <MoneyInput
                              value={pay[field]}
                              onCommit={(n) => commitDerived(row, field, n)}
                              pound
                              allowNegative
                              className={inputCls}
                            />
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-gray-400">Clear a figure to go back to the calculated value.</p>
                      <button
                        onClick={() => remove(row)}
                        className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
