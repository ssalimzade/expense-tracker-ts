import { useRef, useState } from "react";
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

/** Inline percent input (stores a fraction, displays a whole percent). */
function PercentInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const touched = useRef(false);
  const display = `${Math.round(value * 100)}%`;
  return (
    <input
      type="text"
      value={editing ? raw : display}
      onFocus={() => { setEditing(true); touched.current = false; setRaw(String(Math.round(value * 100))); }}
      onChange={(e) => { touched.current = true; setRaw(e.target.value); }}
      onBlur={() => {
        setEditing(false);
        if (!touched.current) return;
        const n = (parseFloat(raw.replace(/[^0-9.]/g, "")) || 0) / 100;
        if (n !== value) onCommit(n);
      }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur(); }}
      className="w-14 rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-sm tabular-nums focus:border-gray-200 focus:outline-none dark:focus:border-gray-700"
    />
  );
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

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
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
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Period</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Gross p.a</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Pension %</th>
              <th className={autoTh}>Pension</th>
              <th className={autoTh}>Deductions</th>
              <th className={autoTh}>Net p.a</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Net p.m</th>
              <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Bonus</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">Δ Net p.m</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((row, i) => {
              const prev = rows[i - 1];
              const deltaAbs = prev ? row.net_pm - prev.net_pm : 0;
              const deltaPct = prev && prev.net_pm ? deltaAbs / prev.net_pm : 0;
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
                  <td className="px-3 py-2.5 text-center">
                    <PercentInput value={row.pension_pct} onCommit={(n) => commitInput(row, "pension_pct", n)} />
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
                    {prev ? (
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
    </Card>
  );
}
