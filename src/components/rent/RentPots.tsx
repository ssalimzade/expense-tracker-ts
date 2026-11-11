import { useState } from "react";
import { useSaveRentItem, useSaveRentPot } from "../../hooks/useRent";
import type { RentData, RentItemDef, RentPotSettlement } from "../../types/rent";
import { potViews, type PotSettlementView, type PotView } from "../../lib/pots";
import { gbp0, formatMonthLabel } from "../../lib/format";
import { Card } from "../common";
import Select from "../Select";

interface Props {
  data: RentData;
  /** Latest month to count towards a balance — usually the current month. */
  upTo: string;
}

/**
 * Under 50p either way reads as "exact": the pots carry pennies but every figure
 * here shows whole pounds, so anything smaller would print as "£0 from savings".
 */
const EPS = 0.5;

/** The pot's most recent bill, in a line. */
function lastLine(s: PotSettlementView): string {
  const when = formatMonthLabel(s.month);
  if (s.partial) {
    const short = s.diff < -EPS ? `, ${gbp0(-s.diff)} of it from savings` : "";
    return `Paid ${gbp0(s.bill)} from the pot in ${when}${short}`;
  }
  return `Settled ${when} — bill ${gbp0(s.bill)}, ${
    s.diff > -EPS ? `${gbp0(Math.max(0, s.diff))} back to savings` : `${gbp0(-s.diff)} taken from savings`
  }`;
}

/** Segmented-control button, shared by both dialogs. */
const tab = (active: boolean) =>
  `flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
  }`;

/**
 * The pots that fund the quarterly bills. Each month's allocation goes in. A
 * bill can be paid from a pot in part, keeping the rest earmarked, or the pot
 * can be settled — closed off, with the surplus (or shortfall) showing up in
 * Diff in bills.
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

  // Every payment is its own entry, so two bills in one month both count and
  // Undo only ever takes back the latest.
  const pay = (pot: PotView, bill: number, partial: boolean) => {
    const entry: RentPotSettlement = { month: upTo, bill, ...(partial && { partial: true }) };
    save.mutate({ key: pot.key, settlements: [...(data.pots?.[pot.key]?.settlements ?? []), entry] });
    setSettling(null);
  };

  const undo = (pot: PotView, entry: PotSettlementView) => {
    const next = (data.pots?.[pot.key]?.settlements ?? []).filter((_, i) => i !== entry.index);
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
            Monthly set-aside builds up here. When a bill lands, pay it from the pot and keep the
            rest in it, or settle the pot — what's left over goes back to savings, a shortfall
            comes out of it.
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
          // Only this month's latest entry can be taken back — older ones have
          // had later months build on them.
          const undoable = last?.month === upTo ? last : undefined;
          // A pot settled this month has nothing left to pay from, so its main
          // button becomes Undo; otherwise Undo sits beside the line it reverses.
          const undoInPlace = undoable && pot.closed;
          return (
            <li key={pot.key} className="px-4 py-3 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-sm font-semibold ${pot.closed ? "text-gray-400" : "text-[#96794a] dark:text-[#d2bc92]"}`}>
                    {pot.label}
                    {pot.closed && <span className="ml-2 text-[10px] uppercase tracking-wider text-gray-400">closed</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {last ? lastLine(last) : "Nothing paid from it yet"}
                    {undoable && !undoInPlace && (
                      <>
                        {" · "}
                        <button
                          onClick={() => undo(pot, undoable)}
                          disabled={save.isPending}
                          className="font-medium text-[#7d6540] hover:underline disabled:opacity-40 dark:text-[#d2bc92]"
                        >
                          Undo
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <p className={`shrink-0 text-lg font-bold tabular-nums ${pot.balance > 0 ? "text-[#96794a] dark:text-[#d2bc92]" : "text-gray-400"}`}>
                  {gbp0(pot.balance)}
                </p>
                {undoInPlace ? (
                  <button
                    onClick={() => undo(pot, undoable)}
                    disabled={save.isPending}
                    className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 dark:bg-gray-700 dark:text-gray-300"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={() => setSettling(pot)}
                    disabled={save.isPending}
                    className="shrink-0 rounded-lg bg-[#c8b58f]/20 px-2.5 py-1 text-xs font-medium text-[#7d6540] hover:bg-[#c8b58f]/30 disabled:opacity-40 dark:bg-[#c8b58f]/10 dark:text-[#d2bc92]"
                  >
                    Pay bill
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
        <SettleDialog pot={settling} month={upTo} onCancel={() => setSettling(null)} onPay={pay} />
      )}
      {creating && (
        <NewPotDialog
          potless={potless}
          month={upTo}
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
 *     ticked accrues. It starts this month: the months before it stay blank.
 */
function NewPotDialog({
  potless,
  month,
  onCancel,
  onCreate,
}: {
  potless: RentItemDef[];
  /** The month a new item starts in. */
  month: string;
  onCancel: () => void;
  onCreate: (item: {
    key?: string;
    label: string;
    saved: boolean;
    pot_default?: boolean;
    since?: string;
  }) => void;
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
      onCreate({ label: label.trim(), saved: true, pot_default: true, since: month });
    }
  };

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
              Adds a column to the table from {formatMonthLabel(month)} on, with a pot of its
              own. Every month you tick it, that month's amount accrues — nothing goes out to a
              biller.
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

/**
 * Asks what the bill came to and whether the pot stays open, previewing what
 * that leaves in the pot and does to savings.
 *
 * Keeping the rest is the default: it is the reversible-feeling choice, and
 * settling — which sends everything left over back to savings — is one tap away.
 */
function SettleDialog({
  pot,
  month,
  onCancel,
  onPay,
}: {
  pot: PotView;
  month: string;
  onCancel: () => void;
  onPay: (pot: PotView, bill: number, partial: boolean) => void;
}) {
  const [raw, setRaw] = useState(String(Math.round(pot.balance * 100) / 100));
  const [partial, setPartial] = useState(true);
  const bill = parseFloat(raw.replace(/[^0-9.]/g, "")) || 0;
  const diff = pot.balance - bill;
  // Paying nothing and keeping everything changes nothing, so don't record it.
  // Settling for £0 is still meaningful: no bill, the whole pot goes to savings.
  const valid = !partial || bill > 0;
  const submit = () => valid && onPay(pot, bill, partial);

  const preview = partial
    ? diff > EPS
      ? { text: `${gbp0(diff)} stays in the pot`, tone: "text-[#96794a] dark:text-[#d2bc92]" }
      : diff < -EPS
      ? { text: `Empties the pot, ${gbp0(-diff)} comes out of savings`, tone: "text-red-500 dark:text-red-400" }
      : { text: "Pot covers it exactly and stays open", tone: "text-gray-400" }
    : diff > EPS
    ? { text: `${gbp0(diff)} goes back to savings and the pot closes`, tone: "text-emerald-600 dark:text-emerald-400" }
    : diff < -EPS
    ? { text: `${gbp0(-diff)} comes out of savings and the pot closes`, tone: "text-red-500 dark:text-red-400" }
    : { text: "Pot covers it exactly and closes", tone: "text-gray-400" };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-800"
      >
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Pay from {pot.label}</p>
        <p className="mt-1 text-xs text-gray-400">
          {gbp0(pot.balance)} in the pot as of {formatMonthLabel(month)}
        </p>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          What did you pay?
        </label>
        <input
          autoFocus
          inputMode="decimal"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onCancel();
          }}
          className="mt-1 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-center text-lg font-semibold tabular-nums focus:border-[#c8b58f] focus:outline-none dark:border-gray-600"
        />

        <div className="mt-3 flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-900/50">
          <button onClick={() => setPartial(true)} className={tab(partial)}>
            Keep the rest
          </button>
          <button onClick={() => setPartial(false)} className={tab(!partial)}>
            Settle fully
          </button>
        </div>

        <p className={`mt-2 text-center text-xs font-medium ${preview.tone}`}>{preview.text}</p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!valid}
            className="flex-1 rounded-lg bg-[#b39767] px-3 py-2 text-sm font-semibold text-white hover:bg-[#9c8257] disabled:opacity-40"
          >
            {partial ? "Pay" : "Settle"}
          </button>
        </div>
      </div>
    </div>
  );
}
