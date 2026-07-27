import { useSaveRemunerationRow, useDeleteRemunerationRow } from "../../hooks/useRemuneration";
import type { RemunerationRow, RemunerationDerived } from "../../types/remuneration";
import { resolvePay, isPinned } from "../../lib/remuneration";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";

const currentYear = String(new Date().getFullYear());

interface Props {
  rows: RemunerationRow[];
}

export default function RemunerationTable({ rows }: Props) {
  const save = useSaveRemunerationRow();
  const del = useDeleteRemunerationRow();

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

  // Subtle striped background marks the calculated columns.
  const autoTh = "px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/70 dark:bg-gray-800/40";
  const autoTd = "px-3 py-2.5 text-center bg-gray-50/50 dark:bg-gray-800/30";

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

  const pinTitle = (row: RemunerationRow, field: RemunerationDerived) =>
    isPinned(row, field)
      ? "Overridden — clear the field to go back to the calculated value"
      : "Calculated from gross pay";

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Salary History
          </h2>
          <span className="hidden items-center gap-1.5 text-[11px] text-gray-400 sm:flex">
            <span className="h-2.5 w-2.5 rounded bg-gray-200 dark:bg-gray-700" /> calculated from gross
          </span>
        </div>
        <button
          onClick={addUpdate}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          + Add salary update
        </button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Period</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Gross p.a</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Bonus</th>
              <th className={autoTh}>Pension</th>
              <th className={autoTh}>Deductions</th>
              <th className={autoTh}>Net p.a</th>
              <th className={autoTh}>Net p.m</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">Δ Net p.m</th>
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {displayRows.map(({ row, pay, isCurrent, hasPrev, deltaAbs, deltaPct }, i) => (
              <tr
                key={`${row.period}-${i}`}
                className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                  isCurrent ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                }`}
              >
                <td className="px-6 py-2.5 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <input
                      defaultValue={row.period}
                      onBlur={(e) => rename(row, e.target.value)}
                      onKeyDown={commitOnEnter(row.period)}
                      className="w-44 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold text-gray-700 focus:border-gray-200 focus:outline-none dark:text-gray-300 dark:focus:border-gray-700"
                    />
                    {isCurrent && (
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center">
                  <MoneyInput value={row.gross} onCommit={(n) => commit(row, { gross: n })} pound />
                </td>
                <td className="px-3 py-2.5 text-center">
                  <MoneyInput value={row.bonus} onCommit={(n) => commit(row, { bonus: n })} pound />
                </td>
                {(["pension", "deductions", "net_pa", "net_pm"] as RemunerationDerived[]).map((field) => (
                  <td key={field} className={autoTd} title={pinTitle(row, field)}>
                    <MoneyInput
                      value={pay[field]}
                      onCommit={(n) => commitDerived(row, field, n)}
                      pound
                      allowNegative
                    />
                  </td>
                ))}
                <td className="px-6 py-2.5 text-center whitespace-nowrap">
                  {hasPrev ? (
                    <span className={`font-semibold tabular-nums ${deltaAbs >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {deltaAbs >= 0 ? "+" : "−"}{gbp0(Math.abs(deltaAbs))}
                      <span className="ml-1 text-xs text-gray-400">
                        ({deltaAbs >= 0 ? "+" : ""}{(deltaPct * 100).toFixed(1)}%)
                      </span>
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <button
                    onClick={() => del.mutate(row.period)}
                    title="Remove this salary period"
                    className="rounded-lg px-2 py-1 text-xs font-medium text-red-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — most recent first */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {displayRows.map(({ row, pay, isCurrent, hasPrev, deltaAbs }, i) => (
          <li key={`${row.period}-${i}`} className={`px-4 py-3 ${isCurrent ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <input
                  defaultValue={row.period}
                  onBlur={(e) => rename(row, e.target.value)}
                  onKeyDown={commitOnEnter(row.period)}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-1 py-0.5 font-semibold text-gray-700 focus:border-gray-300 focus:outline-none dark:text-gray-300 dark:focus:border-gray-700"
                />
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                    Current
                  </span>
                )}
              </div>
              {hasPrev && (
                <span className={`shrink-0 text-xs font-semibold tabular-nums ${deltaAbs >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                  {deltaAbs >= 0 ? "+" : "−"}{gbp0(Math.abs(deltaAbs))}
                </span>
              )}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              <div className="flex items-center justify-between gap-1">
                <span className="text-gray-400">Gross p.a</span>
                <MoneyInput value={row.gross} onCommit={(n) => commit(row, { gross: n })} pound className="!w-20 !px-1 !text-right" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <span className="text-gray-400">Bonus</span>
                <MoneyInput value={row.bonus} onCommit={(n) => commit(row, { bonus: n })} pound className="!w-20 !px-1 !text-right" />
              </div>
              {([
                ["pension", "Pension"],
                ["deductions", "Deductions"],
                ["net_pa", "Net p.a"],
                ["net_pm", "Net p.m"],
              ] as [RemunerationDerived, string][]).map(([field, label]) => (
                <div key={field} className="flex items-center justify-between gap-1" title={pinTitle(row, field)}>
                  <span className="text-gray-400">{label}</span>
                  <MoneyInput
                    value={pay[field]}
                    onCommit={(n) => commitDerived(row, field, n)}
                    pound
                    allowNegative
                    className="!w-20 !px-1 !text-right"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => del.mutate(row.period)}
              className="mt-2 text-xs font-medium text-red-400 hover:text-red-600"
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
