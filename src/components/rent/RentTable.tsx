import { useState } from "react";
import { createPortal } from "react-dom";
import { useSaveRentMonth } from "../../hooks/useRent";
import type { RentData, RentItemDef, RentLineItem, RentMonthEntry, RentMatch } from "../../types/rent";
import { gbp0 } from "../../lib/format";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "long" });

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const blank: RentLineItem = { amount: 0, paid: false };

// Mobile-card column split: the housing bills on the left, the water group on
// the right (matching how the user thinks about them).
const LEFT_KEYS = ["flat", "council_tax", "energy", "wifi"];
const RIGHT_KEYS = ["water", "water_savings", "hot_water"];

/**
 * Marks a line item paid / unpaid. When a real transaction was matched the item
 * is auto-paid (link icon, not toggleable) with the payment shown on hover.
 */
function PaidToggle({
  paid,
  auto,
  match,
  hint = "",
  onToggle,
  onOpenMatch,
}: {
  paid: boolean;
  auto: boolean;
  match?: RentMatch;
  /** Appended to the title when paid — surfaces the allocation it's hiding. */
  hint?: string;
  onToggle: (anchor: DOMRect) => void;
  onOpenMatch?: (match: RentMatch) => void;
}) {
  if (auto && match) {
    return (
      <button
        type="button"
        onClick={() => onOpenMatch?.(match)}
        title={`Auto-paid ${gbp0(match.amount)} on ${match.date} (${match.description}) — click to view transaction`}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white"
      >
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
          <path d="M7.78 3.16a2.75 2.75 0 0 1 3.89 3.89l-1.6 1.6a.75.75 0 0 1-1.06-1.06l1.6-1.6a1.25 1.25 0 0 0-1.77-1.77l-1.6 1.6A.75.75 0 1 1 6.18 4.76l1.6-1.6Zm.5 4.02a.75.75 0 0 1 0 1.06l-1.6 1.6a1.25 1.25 0 0 0 1.77 1.77l1.6-1.6a.75.75 0 1 1 1.06 1.06l-1.6 1.6a2.75 2.75 0 0 1-3.89-3.89l1.6-1.6a.75.75 0 0 1 1.06 0Z" />
        </svg>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => onToggle(e.currentTarget.getBoundingClientRect())}
      title={paid ? `Paid${hint} — click to mark unpaid` : "Unpaid — click to mark paid"}
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
        paid
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
      }`}
    >
      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
        <path d="M2.5 6.2 4.7 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * Asks what actually left the account when a bill is ticked by hand, pre-filled
 * with the allocation so the common "paid what I budgeted" case is one Enter.
 * Portalled with fixed positioning so the table's scroll container can't clip
 * it. Enter or clicking away commits; Escape leaves the bill unticked.
 */
function PaidPrompt({
  anchor,
  label,
  allocated,
  onConfirm,
  onCancel,
}: {
  anchor: DOMRect;
  label: string;
  allocated: number;
  onConfirm: (paid: number) => void;
  onCancel: () => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(allocated)));
  const commit = () => onConfirm(parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0);

  const WIDTH = 176;
  const top = Math.min(anchor.bottom + 6, window.innerHeight - 120);
  const left = Math.min(Math.max(8, anchor.left - 8), window.innerWidth - WIDTH - 8);

  return createPortal(
    <>
      {/* Clicking away is a commit, matching the commit-on-blur money inputs. */}
      <span className="fixed inset-0 z-[9998]" onClick={commit} />
      <div
        style={{ position: "fixed", top, left, width: WIDTH }}
        className="z-[9999] rounded-xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <p className="mb-1.5 truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          {label} — paid
        </p>
        <input
          autoFocus
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onCancel();
          }}
          className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1.5 text-center text-sm tabular-nums focus:border-indigo-400 focus:outline-none dark:border-gray-600"
        />
        <p className="mt-1.5 text-[10px] text-gray-400">Allocated {gbp0(allocated)}</p>
      </div>
    </>,
    document.body,
  );
}

interface Props {
  data: RentData;
  months: string[]; // months in the selected year, ascending
  onOpenMatch?: (match: RentMatch) => void;
}

export default function RentTable({ data, months, onOpenMatch }: Props) {
  const save = useSaveRentMonth();
  const items = data.items;
  const reconciled = data.reconciled ?? {};

  const get = (month: string): RentMonthEntry => data.months[month] ?? {};
  const cell = (month: string, key: string): RentLineItem => get(month)[key] ?? blank;
  const match = (month: string, key: string): RentMatch | undefined => reconciled[month]?.[key];
  // What the bill actually cost: a matched transaction wins, then a hand-entered
  // paid amount, else the allocation.
  const effectiveAmount = (month: string, key: string) => {
    const c = cell(month, key);
    return match(month, key)?.amount ?? (c.paid ? c.paid_amount ?? c.amount : c.amount);
  };
  // Effective paid = manually ticked OR a matching transaction exists.
  const isPaid = (month: string, key: string) => cell(month, key).paid || !!match(month, key);
  // Ticked by hand with no matching transaction — here the cell's number is what
  // was paid, so edits land on `paid_amount` rather than the allocation.
  const isManualPaid = (month: string, key: string) =>
    cell(month, key).paid && !match(month, key);
  // Reminds you of the allocation the cell is currently hiding.
  const paidHint = (month: string, key: string) => {
    const c = cell(month, key);
    return c.paid_amount != null ? ` ${gbp0(c.paid_amount)} of ${gbp0(c.amount)} allocated` : "";
  };

  const update = (month: string, key: string, patch: Partial<RentLineItem>) => {
    const entry: RentMonthEntry = {};
    for (const it of items) {
      const existing = cell(month, it.key);
      entry[it.key] = it.key === key ? { ...existing, ...patch } : { ...existing };
    }
    save.mutate({ month, entry });
  };

  // Equal-to-allocated is stored as null so the paid figure keeps tracking
  // `amount` if the allocation is edited later.
  const savePaidAmount = (month: string, key: string, n: number) =>
    update(month, key, { paid_amount: n === cell(month, key).amount ? null : n });

  // Ticking asks what actually left the account; unticking drops that figure so
  // it can't linger as a stale diff.
  const [prompt, setPrompt] = useState<
    { month: string; key: string; label: string; allocated: number; anchor: DOMRect } | null
  >(null);

  const onTogglePaid = (month: string, it: RentItemDef, anchor: DOMRect) => {
    const c = cell(month, it.key);
    if (c.paid) return update(month, it.key, { paid: false, paid_amount: null });
    setPrompt({ month, key: it.key, label: it.label, allocated: c.amount, anchor });
  };

  const confirmPrompt = (paid: number) => {
    if (!prompt) return;
    update(prompt.month, prompt.key, {
      paid: true,
      paid_amount: paid === prompt.allocated ? null : paid,
    });
    setPrompt(null);
  };

  const monthTotal = (month: string) => items.reduce((s, it) => s + effectiveAmount(month, it.key), 0);
  const monthPaid = (month: string) =>
    items.reduce((s, it) => s + (isPaid(month, it.key) ? effectiveAmount(month, it.key) : 0), 0);

  // Ordered item lists for the mobile card's two columns.
  const orderItems = (keys: string[]) =>
    keys.map((k) => items.find((i) => i.key === k)).filter(Boolean) as RentItemDef[];
  const knownKeys = new Set([...LEFT_KEYS, ...RIGHT_KEYS]);
  const leftItems = orderItems(LEFT_KEYS);
  const rightItems = [...orderItems(RIGHT_KEYS), ...items.filter((i) => !knownKeys.has(i.key))];

  // One category row in a mobile card: paid/linked toggle on the left, then the
  // label, then the amount aligned right.
  const renderRow = (month: string, it: RentItemDef) => {
    const c = cell(month, it.key);
    const m = match(month, it.key);
    return (
      <div key={it.key} className="flex items-center gap-1.5">
        <PaidToggle
          paid={c.paid}
          auto={!!m}
          match={m}
          hint={paidHint(month, it.key)}
          onToggle={(anchor) => onTogglePaid(month, it, anchor)}
          onOpenMatch={onOpenMatch}
        />
        <span className={`min-w-0 flex-1 truncate ${it.saved ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>{it.label}</span>
        <MoneyInput
          value={effectiveAmount(month, it.key)}
          onCommit={(n) =>
            isManualPaid(month, it.key)
              ? savePaidAmount(month, it.key, n)
              : update(month, it.key, { amount: n })
          }
          color={it.saved ? "#d97706" : undefined}
          className="!w-14 !px-1 !text-right"
        />
      </div>
    );
  };

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Rent &amp; Utilities (Wyndham)
        </h2>
        <div className="hidden items-center gap-3 text-xs text-gray-400 sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" /> set aside to savings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> paid
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> auto-paid (matched txn)
          </span>
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Month</th>
              {items.map((it: RentItemDef) => (
                <th key={it.key} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider whitespace-nowrap">
                  <span className={it.saved ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-white"}>
                    {it.label}
                  </span>
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {months.map((month) => {
              const isFuture = month > currentMonth;
              const isCurrent = month === currentMonth;
              const total = monthTotal(month);
              const paid = monthPaid(month);
              const fullyPaid = total > 0 && paid >= total - 0.001;
              return (
                <tr
                  key={month}
                  className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isFuture ? "opacity-50" : ""} ${
                    isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                  }`}
                >
                  <td className="px-6 py-2.5 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {mo(month)}
                  </td>
                  {items.map((it) => {
                    const c = cell(month, it.key);
                    const m = match(month, it.key);
                    return (
                      <td key={it.key} className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <MoneyInput
                            value={effectiveAmount(month, it.key)}
                            onCommit={(n) =>
                              isManualPaid(month, it.key)
                                ? savePaidAmount(month, it.key, n)
                                : update(month, it.key, { amount: n })
                            }
                            color={it.saved ? "#d97706" : undefined}
                          />
                          <PaidToggle
                            paid={c.paid}
                            auto={!!m}
                            match={m}
                            hint={paidHint(month, it.key)}
                            onToggle={(anchor) => onTogglePaid(month, it, anchor)}
                            onOpenMatch={onOpenMatch}
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="px-6 py-2.5 text-center whitespace-nowrap">
                    <div className="font-bold tabular-nums text-gray-800 dark:text-gray-100">{gbp0(total)}</div>
                    <div className={`text-[11px] font-medium ${fullyPaid ? "text-emerald-500" : "text-gray-400"}`}>
                      {fullyPaid ? "paid" : `${gbp0(total - paid)} left`}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {months.map((month) => {
          const isFuture = month > currentMonth;
          const isCurrent = month === currentMonth;
          const total = monthTotal(month);
          const paid = monthPaid(month);
          const fullyPaid = total > 0 && paid >= total - 0.001;
          return (
            <li
              key={month}
              className={`px-4 py-3 ${isFuture ? "opacity-50" : ""} ${isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{mo(month)}</span>
                <span className="flex items-baseline gap-2 pr-1">
                  <span className={`text-[11px] font-medium ${fullyPaid ? "text-emerald-500" : "text-gray-400"}`}>
                    {fullyPaid ? "paid" : `${gbp0(total - paid)} left`}
                  </span>
                  <span className="font-bold tabular-nums text-gray-800 dark:text-gray-100">{gbp0(total)}</span>
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="space-y-1">{leftItems.map((it) => renderRow(month, it))}</div>
                <div className="space-y-1">{rightItems.map((it) => renderRow(month, it))}</div>
              </div>
            </li>
          );
        })}
      </ul>

      {prompt && (
        <PaidPrompt
          anchor={prompt.anchor}
          label={prompt.label}
          allocated={prompt.allocated}
          onConfirm={confirmPrompt}
          onCancel={() => setPrompt(null)}
        />
      )}
    </Card>
  );
}
