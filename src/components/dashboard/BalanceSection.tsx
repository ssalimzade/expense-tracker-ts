import { useEffect, useMemo, useRef, useState } from "react";
import { useBalance, useSaveBalance } from "../../hooks/useBalance";
import { useRent } from "../../hooks/useRent";
import MoneyInput from "../MoneyInput";
import { gbp, gbp0, formatMonthLabel } from "../../lib/format";
import type { BalanceValues } from "../../api/balance";

type DiffPart = { label: string; allocated: number; paid: number; diff: number };

/** Hover/tap "ⓘ" that reveals how the auto Diff in bills was calculated. */
function DiffBreakdown({
  parts,
  total,
  month,
  overridden,
}: {
  parts: DiffPart[];
  total: number;
  month: string;
  overridden: boolean;
}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number | null>(null);
  const cancel = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const openNow = () => {
    cancel();
    setOpen(true);
  };
  const closeSoon = () => {
    cancel();
    timer.current = window.setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => cancel, []);

  const neg = "text-red-500 dark:text-red-400";
  const pos = "text-emerald-500 dark:text-emerald-400";

  // The wrapper spans the card (pointer-events-none) so the panel can anchor to
  // the card's right edge on mobile and stay on-screen; the button sits at the
  // top-left corner.
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0">
      <button
        type="button"
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onClick={() => (open ? setOpen(false) : openNow())}
        title="How this is calculated"
        className="pointer-events-auto absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-black/5 hover:text-gray-600 dark:hover:bg-white/10 dark:hover:text-gray-200"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 3.25a.9.9 0 1 1 0 1.8.9.9 0 0 1 0-1.8ZM7.1 7.2h1.4a.4.4 0 0 1 .4.4v3.4h.5a.4.4 0 0 1 0 .8H6.6a.4.4 0 0 1 0-.8h.5V8H7.1a.4.4 0 0 1 0-.8Z" />
        </svg>
      </button>
      {open && (
        <>
          {/* Outside-tap catcher (mobile) — desktop relies on hover-out. */}
          <span
            onClick={() => setOpen(false)}
            className="pointer-events-auto fixed inset-0 z-40 sm:hidden"
          />
          <div
            onMouseEnter={cancel}
            onMouseLeave={closeSoon}
            className="pointer-events-auto absolute right-1 top-9 z-50 w-max min-w-[13rem] max-w-[calc(100vw-1.5rem)] cursor-default rounded-xl border border-gray-200 bg-white p-3 text-left shadow-2xl dark:border-gray-700 dark:bg-gray-800 sm:left-1 sm:right-auto"
          >
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Bills paid in {formatMonthLabel(month)}
            </p>
            {parts.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No bill differences this month.
              </p>
            ) : (
              <table className="w-full border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400">
                    <th className="pb-1.5 pr-4 text-left font-medium">Bill</th>
                    <th className="px-2 pb-1.5 text-right font-medium">Allocated</th>
                    <th className="px-2 pb-1.5 text-right font-medium">Paid</th>
                    <th className="pl-3 pb-1.5 text-right font-medium">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {parts.map((p) => (
                    <tr key={p.label}>
                      <td className="py-[3px] pr-4 text-left font-medium text-gray-700 dark:text-gray-200">{p.label}</td>
                      <td className="px-2 py-[3px] text-right text-gray-500 dark:text-gray-400">{gbp(p.allocated)}</td>
                      <td className="px-2 py-[3px] text-right text-gray-500 dark:text-gray-400">{gbp(p.paid)}</td>
                      <td className={`py-[3px] pl-3 text-right font-semibold ${p.diff < 0 ? neg : pos}`}>{gbp(p.diff)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="border-t border-gray-200 pt-2 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-600 dark:text-gray-300">
                      Total
                    </td>
                    <td className={`border-t border-gray-200 pl-3 pt-2 text-right text-sm font-bold dark:border-gray-600 ${total < 0 ? neg : pos}`}>
                      {gbp0(total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
            {overridden && (
              <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] leading-snug text-amber-600 dark:border-gray-700/60 dark:text-amber-400">
                Manual override in use — clear the field to switch to this total.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type BalanceCardKey = "savings" | "monzo" | "chase" | "barclays" | "amex" | "diff_in_bills";

const ITEMS: { key: BalanceCardKey; label: string }[] = [
  { key: "savings", label: "Savings" },
  { key: "monzo", label: "Monzo" },
  { key: "chase", label: "Chase" },
  { key: "barclays", label: "Barclays" },
  { key: "amex", label: "AMEX" },
  { key: "diff_in_bills", label: "Diff in bills" },
];

const DEFAULTS: BalanceValues = {
  savings: 0,
  monzo: 0,
  chase: 0,
  amex: 0,
  barclays: 0,
  diff_in_bills: 0,
  diff_in_bills_manual: false,
};

function cardStyle(v: number) {
  if (v > 0)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/40",
      border: "border-emerald-100 dark:border-emerald-900",
    };
  if (v < 0)
    return {
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-50/60 dark:bg-red-950/40",
      border: "border-red-100 dark:border-red-900",
    };
  return {
    text: "text-gray-900 dark:text-white",
    bg: "bg-gray-50 dark:bg-gray-800/60",
    border: "border-gray-200 dark:border-gray-700",
  };
}

export default function BalanceSection({ month }: { month: string }) {
  const query = useBalance(month);
  const rentQuery = useRent();
  const save = useSaveBalance(month);
  const [draft, setDraft] = useState<BalanceValues>(DEFAULTS);

  useEffect(() => {
    if (query.data) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { month: _m, ...vals } = query.data;
      setDraft(vals);
    }
  }, [query.data]);

  // Auto "diff in bills" = for every bill actually PAID this month, the gap
  // between what was allocated in the rent tab and what was really paid.
  // Bills reconcile to a rent row that can be a different month (e.g. energy is
  // billed a month in arrears), so we group by the payment date, not the row.
  const autoDiff = useMemo(() => {
    const data = rentQuery.data;
    const parts: { label: string; allocated: number; paid: number; diff: number }[] = [];
    if (!data) return { total: 0, parts };
    const reconciled = data.reconciled ?? {};
    const months = data.months ?? {};
    const labelOf: Record<string, string> = {};
    for (const it of data.items ?? []) labelOf[it.key] = it.label;
    let raw = 0;
    for (const [rowMonth, matches] of Object.entries(reconciled)) {
      for (const [key, m] of Object.entries(matches)) {
        if (!m?.date || m.date.slice(0, 7) !== month) continue; // paid this month
        const allocated = months[rowMonth]?.[key]?.amount ?? 0;
        const diff = allocated - m.amount;
        raw += diff;
        // Only surface bills that actually differ; exact matches add nothing.
        if (Math.abs(diff) >= 0.005) parts.push({ label: labelOf[key] ?? key, allocated, paid: m.amount, diff });
      }
    }
    parts.sort((a, b) => a.label.localeCompare(b.label));
    return { total: Math.round(raw), parts };
  }, [rentQuery.data, month]);
  const autoDiffInBills = autoDiff.total;

  const diffInBills = draft.diff_in_bills_manual ? draft.diff_in_bills : autoDiffInBills;

  function commit(key: keyof BalanceValues, value: number) {
    const next: BalanceValues = { ...draft, [key]: value };
    if (key === "diff_in_bills") {
      if (value === 0) {
        // Cleared the field → fall back to the auto-calculated value.
        next.diff_in_bills = autoDiffInBills;
        next.diff_in_bills_manual = false;
      } else {
        next.diff_in_bills_manual = true;
      }
    }
    setDraft(next);
    save.mutate(next);
  }

  function resetDiffInBills() {
    const next: BalanceValues = {
      ...draft,
      diff_in_bills: autoDiffInBills,
      diff_in_bills_manual: false,
    };
    setDraft(next);
    save.mutate(next);
  }

  const totalBalance = ITEMS.reduce((sum, { key }) => {
    const value = key === "diff_in_bills" ? diffInBills : draft[key];
    return sum + value;
  }, 0);
  const totalStyle = cardStyle(totalBalance);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Balances
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {ITEMS.map(({ key, label }) => {
          const val = key === "diff_in_bills" ? diffInBills : draft[key];
          const { text, bg, border } = cardStyle(val);
          return (
            <div
              key={key}
              className={`relative rounded-2xl border ${border} ${bg} px-2 py-2 text-center sm:px-4 sm:py-4`}
            >
              {key === "diff_in_bills" && (
                <DiffBreakdown
                  parts={autoDiff.parts}
                  total={autoDiffInBills}
                  month={month}
                  overridden={draft.diff_in_bills_manual}
                />
              )}
              <p className="text-[10px] font-medium uppercase leading-tight tracking-wider text-gray-500 dark:text-gray-400 sm:text-xs">
                {label}
              </p>
              <div className="mt-1.5 flex justify-center">
                <div className="relative w-full">
                  <MoneyInput
                    value={val}
                    onCommit={(v) => commit(key, v)}
                    allowNegative
                    pound
                    className={`!w-full !text-base !font-bold !tracking-tight sm:!text-2xl ${text}`}
                  />
                  {key === "diff_in_bills" && draft.diff_in_bills_manual && (
                    <button
                      type="button"
                      onClick={resetDiffInBills}
                      title="Reset to auto-calculated diff"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      Auto
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Read-only sum of all balances above */}
        <div className={`col-span-3 rounded-2xl border ${totalStyle.border} ${totalStyle.bg} px-3 py-2.5 text-center sm:col-span-1 sm:px-4 sm:py-4`}>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Total Balance
          </p>
          <p className={`mt-1.5 text-xl font-bold tracking-tight sm:text-2xl ${totalStyle.text}`}>
            {gbp0(totalBalance)}
          </p>
        </div>
      </div>
    </div>
  );
}
