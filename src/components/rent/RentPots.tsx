import { useState } from "react";
import { useSaveRentItem, useSaveRentPot } from "../../hooks/useRent";
import type { RentData, RentItemDef, RentPotSettlement } from "../../types/rent";
import { potViews, type PotView } from "../../lib/pots";
import { gbp0, formatMonthLabel } from "../../lib/format";
import { Card } from "../common";
import Select from "../Select";

interface Props {
  data: RentData;
  /** Latest month to count towards a balance — usually the current month. */
  upTo: string;
}

/**
 * The pots that fund the quarterly bills. Each month's allocation goes in;
 * settling a pot records what the bill actually came to and empties it, leaving
 * the surplus (or shortfall) to show up in Diff in bills.
 */
export default function RentPots({ data, upTo }: Props) {
  const save = useSaveRentPot();
  const saveItem = useSaveRentItem();
  const pots = potViews(data, upTo);
  const [settling, setSettling] = useState<PotView | null>(null);
  const [creating, setCreating] = useState(false);

  // Bills that could take a pot — everything that hasn't got one already.
  const potless = (data.items ?? []).filter((it) => !it.saved);

  const removePot = (pot: PotView) => {
    saveItem.mutate({ key: pot.key, label: pot.label, saved: false, delete: true });
  };

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
      <div className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
            Bills Pots
          </h2>
          <p className="mt-1 text-xs text-gray-400">
            Monthly set-aside builds up here. Settle a pot when its bill lands — what's left over
            stays in savings, a shortfall comes out of it.
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="shrink-0 rounded-lg bg-[#b39767] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#9c8257]"
        >
          + New pot
        </button>
      </div>

      {pots.length === 0 && (
        <p className="px-4 py-6 text-center text-xs text-gray-400 sm:px-6">
          No pots yet. Create one to start setting money aside for a bill.
        </p>
      )}

      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
        {pots.map((pot) => {
          const last = pot.settlements[pot.settlements.length - 1];
          return (
            <li key={pot.key} className="px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${pot.closed ? "text-gray-400" : "text-[#96794a] dark:text-[#d2bc92]"}`}>
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
                <p className={`shrink-0 text-lg font-bold tabular-nums ${pot.balance > 0 ? "text-[#96794a] dark:text-[#d2bc92]" : "text-gray-400"}`}>
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
                    className="shrink-0 rounded-lg bg-[#c8b58f]/20 px-2.5 py-1 text-xs font-medium text-[#7d6540] hover:bg-[#c8b58f]/30 dark:bg-[#c8b58f]/10 dark:text-[#d2bc92]"
                  >
                    Settle
                  </button>
                )}
                <button
                  onClick={() => removePot(pot)}
                  title="Remove this pot"
                  aria-label={`Remove the ${pot.label} pot`}
                  className="shrink-0 rounded-lg px-1.5 py-1 text-gray-300 hover:bg-red-50 hover:text-red-500 dark:text-gray-600 dark:hover:bg-red-950/40"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-3.5 w-3.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {settling && (
        <SettleDialog pot={settling} month={upTo} onCancel={() => setSettling(null)} onSettle={settle} />
      )}
      {creating && (
        <NewPotDialog
          potless={potless}
          onCancel={() => setCreating(false)}
          onCreate={(item) => {
            saveItem.mutate(item);
            setCreating(false);
          }}
        />
      )}
    </Card>
  );
}

/**
 * Two ways to get a pot, and the difference is only what an unmarked month
 * means afterwards:
 *
 *   on an existing bill — Water is paid most months and saved for in the
 *     others, so months stay payments unless the tick says otherwise, and the
 *     bill's history is left exactly as it reads today;
 *   as a new item — a set-aside with no bill of its own, so every month it is
 *     ticked accrues.
 */
function NewPotDialog({
  potless,
  onCancel,
  onCreate,
}: {
  potless: RentItemDef[];
  onCancel: () => void;
  onCreate: (item: { key?: string; label: string; saved: boolean; pot_default?: boolean }) => void;
}) {
  // Default to attaching, unless every bill already has a pot.
  const [mode, setMode] = useState<"existing" | "new">(potless.length ? "existing" : "new");
  const [key, setKey] = useState(potless[0]?.key ?? "");
  const [label, setLabel] = useState("");

  const chosen = potless.find((i) => i.key === key);
  const valid = mode === "existing" ? !!chosen : label.trim().length > 0;

  const create = () => {
    if (!valid) return;
    if (mode === "existing" && chosen) {
      onCreate({ key: chosen.key, label: chosen.label, saved: true, pot_default: false });
    } else {
      onCreate({ label: label.trim(), saved: true, pot_default: true });
    }
  };

  const tab = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
      active
        ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
        : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
    }`;

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">New pot</p>

        <div className="mt-3 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/50">
          <button
            disabled={!potless.length}
            onClick={() => setMode("existing")}
            className={`${tab(mode === "existing")} disabled:opacity-40`}
          >
            For a bill
          </button>
          <button onClick={() => setMode("new")} className={tab(mode === "new")}>
            Something new
          </button>
        </div>

        {mode === "existing" ? (
          <>
            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              Which bill?
            </label>
            {potless.length ? (
              <div className="mt-1">
                <Select
                  value={key}
                  onChange={setKey}
                  options={potless.map((i) => ({ value: i.key, label: i.label }))}
                />
              </div>
            ) : (
              <p className="mt-1 text-xs text-gray-400">Every bill already has a pot.</p>
            )}
            <p className="mt-2 text-xs text-gray-400">
              {chosen?.label ?? "The bill"} keeps working exactly as it does now — every month
              already recorded stays a payment. From here on, ticking it asks whether that month
              was paid out or set aside.
            </p>
          </>
        ) : (
          <>
            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              What's it for?
            </label>
            <input
              autoFocus
              value={label}
              placeholder="e.g. Service Charge"
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") create();
                if (e.key === "Escape") onCancel();
              }}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-sm font-medium focus:border-[#c8b58f] focus:outline-none dark:border-gray-600"
            />
            <p className="mt-2 text-xs text-gray-400">
              Adds a column to the table with a pot of its own. Every month you tick it, that
              month's amount accrues — nothing goes out to a biller.
            </p>
          </>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={create}
            disabled={!valid}
            className="flex-1 rounded-lg bg-[#b39767] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9c8257] disabled:opacity-40"
          >
            Create pot
          </button>
        </div>
      </div>
    </div>
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
          className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-center text-lg font-semibold tabular-nums focus:border-[#c8b58f] focus:outline-none dark:border-gray-600"
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
            className="flex-1 rounded-lg bg-[#b39767] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9c8257]"
          >
            Settle
          </button>
        </div>
      </div>
    </div>
  );
}
