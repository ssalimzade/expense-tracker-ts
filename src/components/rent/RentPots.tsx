import { useState } from "react";
import { useSaveRentPot } from "../../hooks/useRent";
import type { RentData, RentPotSettlement } from "../../types/rent";
import { potViews, type PotView } from "../../lib/pots";
import { gbp0, formatMonthLabel } from "../../lib/format";
import { Card } from "../common";

interface Props {
  data: RentData;
  /** Latest month to count towards a balance — usually the current month. */
  upTo: string;
}

/**
 * The savings pots behind the quarterly bills. Each month's allocation goes in;
 * settling a pot records what the bill actually came to and empties it, leaving
 * the surplus (or shortfall) to show up in Diff in bills.
 */
export default function RentPots({ data, upTo }: Props) {
  const save = useSaveRentPot();
  const pots = potViews(data, upTo);
  const [settling, setSettling] = useState<PotView | null>(null);

  if (pots.length === 0) return null;

  const settle = (pot: PotView, bill: number) => {
    const kept = (data.pots?.[pot.key]?.settlements ?? []).filter((s) => s.month !== upTo);
    const next: RentPotSettlement[] = [...kept, { month: upTo, bill }];
    save.mutate({ key: pot.key, settlements: next });
    setSettling(null);
  };

  const reopen = (pot: PotView) => {
    if (!pot.lastSettled) return;
    const next = (data.pots?.[pot.key]?.settlements ?? []).filter((s) => s.month !== pot.lastSettled);
    save.mutate({ key: pot.key, settlements: next });
  };

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Savings Pots
        </h2>
        <p className="mt-1 text-xs text-gray-400">
          Monthly set-aside builds up here. Settle a pot when its bill lands — what's left over
          stays in savings, a shortfall comes out of it.
        </p>
      </div>

      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
        {pots.map((pot) => {
          const last = pot.settlements[pot.settlements.length - 1];
          return (
            <li key={pot.key} className="px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${pot.closed ? "text-gray-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {pot.label}
                    {pot.closed && <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400">closed</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {last
                      ? `Settled ${formatMonthLabel(last.month)} — bill ${gbp0(last.bill)}, ${
                          last.diff >= 0 ? `${gbp0(last.diff)} left in savings` : `${gbp0(-last.diff)} taken from savings`
                        }`
                      : "Never settled"}
                  </p>
                </div>
                <p className={`shrink-0 text-lg font-bold tabular-nums ${pot.balance > 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>
                  {gbp0(pot.balance)}
                </p>
                {pot.closed && pot.lastSettled === upTo ? (
                  <button
                    onClick={() => reopen(pot)}
                    className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={() => setSettling(pot)}
                    className="shrink-0 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-300"
                  >
                    Settle
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {settling && (
        <SettleDialog pot={settling} month={upTo} onCancel={() => setSettling(null)} onSettle={settle} />
      )}
    </Card>
  );
}

/** Asks what the bill came to, and previews what that does to savings. */
function SettleDialog({
  pot,
  month,
  onCancel,
  onSettle,
}: {
  pot: PotView;
  month: string;
  onCancel: () => void;
  onSettle: (pot: PotView, bill: number) => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(pot.balance)));
  const bill = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
  const diff = pot.balance - bill;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Settle {pot.label}</p>
        <p className="mt-1 text-xs text-gray-400">
          {gbp0(pot.balance)} in the pot as of {formatMonthLabel(month)}
        </p>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          What did the bill come to?
        </label>
        <input
          autoFocus
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSettle(pot, bill);
            if (e.key === "Escape") onCancel();
          }}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-center text-lg font-semibold tabular-nums focus:border-amber-400 focus:outline-none dark:border-gray-600"
        />

        <p className={`mt-2 text-center text-xs font-medium ${diff > 0 ? "text-emerald-600 dark:text-emerald-400" : diff < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>
          {diff > 0
            ? `${gbp0(diff)} stays in savings`
            : diff < 0
            ? `${gbp0(-diff)} comes out of savings`
            : "Pot covers it exactly"}
        </p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSettle(pot, bill)}
            className="flex-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600"
          >
            Settle
          </button>
        </div>
      </div>
    </div>
  );
}
