import { useState } from "react";
import { takeHome } from "../../lib/tax";
import { gbp0 } from "../../lib/format";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";

interface Props {
  defaultAnnual: number;
  /** Current net monthly, to show the "diff vs current" reference. */
  currentNetMonthly?: number;
}

/** A small Yes/No pill toggle. */
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-500">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export default function TakeHomeCalculator({ defaultAnnual, currentNetMonthly }: Props) {
  const [annual, setAnnual] = useState(defaultAnnual);
  const [increaseRaw, setIncreaseRaw] = useState(""); // string so a leading 0 can be cleared
  const [vitality, setVitality] = useState(true);
  const [pension, setPension] = useState(true);

  const increasePct = parseFloat(increaseRaw) || 0;
  const r = takeHome({ annual, increasePct: increasePct / 100, vitality, pension });

  // Always render the same set of rows so the card height never shifts when a
  // toggle is flipped. Disabled rows show "—".
  const lines = [
    { label: "Gross salary", value: r.gross, on: true, tone: "text-gray-700 dark:text-gray-200" },
    { label: "Pension (4%)", value: -r.pension, on: pension, tone: "text-purple-600 dark:text-purple-400" },
    { label: "Vitality (taxable)", value: r.medTaxable, on: vitality, tone: "text-gray-400" },
    { label: "Income tax (PAYE)", value: -r.paye, on: true, tone: "text-red-600 dark:text-red-400" },
    { label: "National Insurance", value: -r.nic, on: true, tone: "text-red-600 dark:text-red-400" },
  ];

  const diff = currentNetMonthly ? r.netMonthly - currentNetMonthly : null;

  return (
    <Card className="flex h-full flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Take Home Calculator
        </h2>
        <span className="text-[11px] text-gray-400">England 2025/26</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Annual salary</span>
          <div className="rounded-lg border border-gray-200 px-1 py-1 dark:border-gray-700">
            <MoneyInput value={annual} onCommit={setAnnual} pound className="w-full" />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500">Increase by %</span>
          <input
            type="text"
            inputMode="decimal"
            value={increaseRaw}
            placeholder="0"
            onChange={(e) => setIncreaseRaw(e.target.value.replace(/[^0-9.]/g, ""))}
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </label>
        <Toggle on={vitality} onChange={setVitality} label="Vitality" />
        <Toggle on={pension} onChange={setPension} label="Pension" />
      </div>

      <div className="mt-auto space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{l.label}</span>
            {l.on ? (
              <span className={`font-medium tabular-nums ${l.tone}`}>
                {l.value < 0 ? "−" : ""}{gbp0(Math.abs(l.value))}
              </span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">—</span>
            )}
          </div>
        ))}
        <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2.5 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Net take-home</span>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {gbp0(r.netMonthly)}<span className="text-xs font-normal text-gray-400">/mo</span>
            </div>
            <div className="text-xs text-gray-400">{gbp0(r.netAnnual)}/yr</div>
          </div>
        </div>
        {diff !== null && (
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-gray-400">Diff vs current</span>
            <span className={`font-semibold tabular-nums ${diff >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {diff >= 0 ? "+" : "−"}{gbp0(Math.abs(diff))}/mo
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
