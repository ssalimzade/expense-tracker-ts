import { useState } from "react";
import { takeHome } from "../../lib/tax";
import { gbp0 } from "../../lib/format";
import MoneyInput from "../MoneyInput";

interface Props {
  defaultAnnual: number;
  /** Current net monthly, to show the "vs now" reference. */
  currentNetMonthly?: number;
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex flex-1 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
        on
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {label}
      <span className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`}>
        <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all ${on ? "left-3.5" : "left-0.5"}`} />
      </span>
    </button>
  );
}

/** What-if take-home: where each pound of gross goes, and how it compares with now. */
export default function TakeHomeCalculator({ defaultAnnual, currentNetMonthly }: Props) {
  const [annual, setAnnual] = useState(defaultAnnual);
  const [increaseRaw, setIncreaseRaw] = useState(""); // string so a leading 0 can be cleared
  const [vitality, setVitality] = useState(true);
  const [pension, setPension] = useState(true);

  const increasePct = parseFloat(increaseRaw) || 0;
  const r = takeHome({ annual, increasePct: increasePct / 100, vitality, pension });

  // Gross splits exactly into these four; Vitality isn't deducted, it just
  // raises the tax. Always the same rows so the card never jumps in height.
  const parts = [
    { label: "Take-home", value: r.netAnnual, bar: "bg-emerald-500", on: true },
    { label: "Income tax", value: r.paye, bar: "bg-slate-400", on: true, note: vitality ? `incl. tax on ${gbp0(r.medTaxable)} Vitality` : "" },
    { label: "National Insurance", value: r.nic, bar: "bg-slate-300 dark:bg-slate-600", on: true },
    { label: "Pension", value: r.pension, bar: "bg-violet-400", on: pension },
  ];
  const diff = currentNetMonthly ? r.netMonthly - currentNetMonthly : null;

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">What if…</p>
        <span className="text-[11px] text-gray-400">England 2025/26</span>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Salary</span>
          <MoneyInput
            value={annual}
            onCommit={setAnnual}
            pound
            className="mt-1 !w-full rounded-xl !border-gray-200 !py-2 !text-left text-base font-bold dark:!border-gray-700"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Rise</span>
          <div className="relative mt-1">
            <input
              type="text"
              inputMode="decimal"
              value={increaseRaw}
              placeholder="0"
              onChange={(e) => setIncreaseRaw(e.target.value.replace(/[^0-9.]/g, ""))}
              className="w-full rounded-xl border border-gray-200 bg-transparent py-2 pl-3 pr-7 text-base font-bold focus:outline-none dark:border-gray-700"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
          </div>
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <Switch on={pension} onChange={setPension} label="Pension" />
        <Switch on={vitality} onChange={setVitality} label="Vitality" />
      </div>

      <div className="mt-5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-4 text-white dark:from-emerald-700 dark:to-teal-800">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">You'd take home</p>
        <p className="mt-0.5 text-3xl font-extrabold tabular-nums tracking-tight">
          {gbp0(r.netMonthly)}
          <span className="text-sm font-medium text-white/70">/mo</span>
        </p>
        <div className="mt-1 flex items-center justify-between text-xs text-white/80">
          <span>{gbp0(r.netAnnual)} a year</span>
          {diff !== null && Math.round(diff) !== 0 && (
            <span className="rounded-full bg-white/20 px-2 py-0.5 font-semibold tabular-nums">
              {diff >= 0 ? "+" : "−"}
              {gbp0(Math.abs(diff))}/mo vs now
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts
          .filter((p) => p.on && p.value > 0)
          .map((p) => (
            <span key={p.label} className={`h-full first:rounded-l-full last:rounded-r-full ${p.bar}`} style={{ width: `${(p.value / r.gross) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex items-start gap-2">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${p.bar} ${p.on ? "" : "opacity-30"}`} />
            <span className="min-w-0 flex-1 text-gray-600 dark:text-gray-300">
              {p.label}
              {p.note && <span className="block text-[11px] text-gray-400">{p.note}</span>}
            </span>
            {p.on ? (
              <span className="font-semibold tabular-nums">{gbp0(p.value)}</span>
            ) : (
              <span className="text-gray-300 dark:text-gray-600">—</span>
            )}
          </li>
        ))}
        <li className="flex items-center gap-2 border-t border-gray-100 pt-2 text-xs text-gray-400 dark:border-gray-800">
          <span className="flex-1">Gross{increasePct ? ` after +${increasePct}%` : ""}</span>
          <span className="font-semibold tabular-nums text-gray-600 dark:text-gray-300">{gbp0(r.gross)}</span>
        </li>
      </ul>
    </div>
  );
}
