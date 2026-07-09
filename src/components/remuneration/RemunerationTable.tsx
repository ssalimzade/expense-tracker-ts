import { useSaveRemunerationRow } from "../../hooks/useRemuneration";
import type { RemunerationRow } from "../../types/remuneration";
import { gbp0 } from "../../lib/format";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";

// Derived (auto-calculated) fields, mirroring the spreadsheet formulas:
//   pension     = -gross * pension_pct
//   net_pa      = net_pm * 12
//   deductions  = -(gross - net_pa + pension)
function computeAuto(row: RemunerationRow) {
  const pension = -Math.abs(row.gross * row.pension_pct);
  const net_pa = row.net_pm * 12;
  const deductions = -(row.gross - net_pa + pension);
  return { pension, net_pa, deductions };
}

const currentYear = String(new Date().getFullYear());

interface Props {
  rows: RemunerationRow[];
}

export default function RemunerationTable({ rows }: Props) {
  const save = useSaveRemunerationRow();

  // Editing an input field recomputes all auto fields; editing an auto field
  // overrides just that value (deductions follows pension/net_pa downstream).
  const commitInput = (row: RemunerationRow, field: keyof RemunerationRow, value: number) => {
    if (value === row[field]) return;
    const next = { ...row, [field]: value };
    save.mutate({ ...next, ...computeAuto(next) });
  };
  const commitPension = (row: RemunerationRow, value: number) => {
    if (value === row.pension) return;
    const deductions = -(row.gross - row.net_pa + value);
    save.mutate({ ...row, pension: value, deductions });
  };
  const commitNetPa = (row: RemunerationRow, value: number) => {
    if (value === row.net_pa) return;
    const deductions = -(row.gross - value + row.pension);
    save.mutate({ ...row, net_pa: value, deductions });
  };
  const commitDeductions = (row: RemunerationRow, value: number) => {
    if (value === row.deductions) return;
    save.mutate({ ...row, deductions: value });
  };

  const addUpdate = () => {
    const last = rows[rows.length - 1];
    save.mutate({
      period: `New update ${currentYear}`,
      gross: last?.gross ?? 0,
      deductions: last?.deductions ?? 0,
      pension: last?.pension ?? 0,
      pension_pct: last?.pension_pct ?? 0.04,
      net_pa: last?.net_pa ?? 0,
      net_pm: last?.net_pm ?? 0,
      bonus: last?.bonus ?? 0,
      current: false,
    });
  };

  // Subtle striped background marks the auto-calculated columns.
  const autoTh = "px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400 bg-gray-50/70 dark:bg-gray-800/40";
  const autoTd = "px-3 py-2.5 text-center bg-gray-50/50 dark:bg-gray-800/30";

  // Show the most recent salary first (both the desktop table and mobile cards).
  // Δ is still computed against the chronologically-previous period.
  const displayRows = rows
    .map((row, i) => {
      const prev = rows[i - 1];
      return {
        row,
        hasPrev: !!prev,
        deltaAbs: prev ? row.net_pm - prev.net_pm : 0,
        deltaPct: prev && prev.net_pm ? (row.net_pm - prev.net_pm) / prev.net_pm : 0,
      };
    })
    .reverse();

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Salary History
          </h2>
          <span className="hidden items-center gap-1.5 text-[11px] text-gray-400 sm:flex">
            <span className="h-2.5 w-2.5 rounded bg-gray-200 dark:bg-gray-700" /> auto-calculated
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
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Period</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Gross p.a</th>
              <th className={autoTh}>Pension</th>
              <th className={autoTh}>Deductions</th>
              <th className={autoTh}>Net p.a</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Net p.m</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Bonus</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">Δ Net p.m</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {displayRows.map(({ row, hasPrev, deltaAbs, deltaPct }) => {
              return (
                <tr
                  key={row.period}
                  className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                    row.current ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""
                  }`}
                >
                  <td className="px-6 py-2.5 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {row.period}
                    {row.current && (
                      <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                        Current
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <MoneyInput value={row.gross} onCommit={(n) => commitInput(row, "gross", n)} pound />
                  </td>
                  <td className={autoTd}>
                    <MoneyInput value={row.pension} onCommit={(n) => commitPension(row, n)} pound allowNegative />
                  </td>
                  <td className={autoTd}>
                    <MoneyInput value={row.deductions} onCommit={(n) => commitDeductions(row, n)} pound allowNegative />
                  </td>
                  <td className={autoTd}>
                    <MoneyInput value={row.net_pa} onCommit={(n) => commitNetPa(row, n)} pound />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <MoneyInput value={row.net_pm} onCommit={(n) => commitInput(row, "net_pm", n)} pound />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <MoneyInput value={row.bonus} onCommit={(n) => commitInput(row, "bonus", n)} pound />
                  </td>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards — most recent first */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {displayRows.map(({ row, hasPrev, deltaAbs }) => (
            <li key={row.period} className={`px-4 py-3 ${row.current ? "bg-emerald-50/40 dark:bg-emerald-950/20" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">
                  {row.period}
                  {row.current && (
                    <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                      Current
                    </span>
                  )}
                </span>
                {hasPrev && (
                  <span className={`shrink-0 pr-1 text-xs font-semibold tabular-nums ${deltaAbs >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                    {deltaAbs >= 0 ? "+" : "−"}{gbp0(Math.abs(deltaAbs))}
                  </span>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Gross p.a</span><MoneyInput value={row.gross} onCommit={(n) => commitInput(row, "gross", n)} pound className="!w-20 !px-1 !text-right" /></div>
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Bonus</span><MoneyInput value={row.bonus} onCommit={(n) => commitInput(row, "bonus", n)} pound className="!w-20 !px-1 !text-right" /></div>
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Deductions</span><MoneyInput value={row.deductions} onCommit={(n) => commitDeductions(row, n)} pound allowNegative className="!w-20 !px-1 !text-right" /></div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Net p.a</span><MoneyInput value={row.net_pa} onCommit={(n) => commitNetPa(row, n)} pound className="!w-20 !px-1 !text-right" /></div>
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Net p.m</span><MoneyInput value={row.net_pm} onCommit={(n) => commitInput(row, "net_pm", n)} pound className="!w-20 !px-1 !text-right" /></div>
                  <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Pension</span><MoneyInput value={row.pension} onCommit={(n) => commitPension(row, n)} pound allowNegative className="!w-20 !px-1 !text-right" /></div>
                </div>
              </div>
            </li>
        ))}
      </ul>
    </Card>
  );
}
