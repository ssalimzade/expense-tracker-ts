import { useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchTransactions } from "../../api/transactions";
import { fetchRepayments } from "../../api/repayments";
import type { Transaction } from "../../types/transaction";
import { TRAVEL_CATEGORIES, type TravelCategory, type Trip, type TripExpense } from "../../types/travel";
import {
  CATEGORY_COLORS,
  LINK_DAYS_AFTER,
  LINK_DAYS_BEFORE,
  formatExpenseDate,
  flexAsTransaction,
  linkCandidates,
  linkWindow,
  monthsBetween,
  newTravelId,
  type LinkCandidate,
} from "../../lib/travel";
import { gbp0 } from "../../lib/format";
import TravelDialog, { primaryBtn, secondaryBtn } from "./TravelDialog";
import SplitControl from "./SplitControl";

type View = "suggested" | "all";

/**
 * Pick card spend from around the trip — bank transactions plus Monzo Flex
 * purchases, which only appear under Repayments — and turn it into trip
 * expenses. Nothing is pre-ticked; likely travel and spend during the trip are
 * surfaced as suggestions, with a one-tap way to tick the during-trip ones. Already-linked
 * rows are shown but locked, and the server refuses to link one transaction twice.
 */
export default function LinkTransactionsDialog({
  trip,
  trips,
  allExpenses,
  onCancel,
  onLink,
}: {
  trip: Trip;
  /** Every trip and expense, to show which trip a transaction is already on. */
  trips: Trip[];
  allExpenses: TripExpense[];
  onCancel: () => void;
  /** Resolves once saved; the dialog stays open (selection intact) if it rejects. */
  onLink: (expenses: Partial<TripExpense>[]) => Promise<void>;
}) {
  const range = linkWindow(trip);
  const months = range ? monthsBetween(range.from, range.to) : [];
  // Same cache entries as the Transactions tab, so months already viewed are instant.
  const results = useQueries({
    queries: months.map((month) => ({
      queryKey: ["transactions", month],
      queryFn: () => fetchTransactions(month),
    })),
  });
  // Same cache entry as the Repayments tab.
  const flex = useQuery({ queryKey: ["repayments"], queryFn: fetchRepayments, enabled: !!range });
  const loading = results.some((r) => r.isLoading) || flex.isLoading;
  const failed = results.find((r) => r.error)?.error ?? flex.error;

  const candidates = linkCandidates(
    trip,
    [
      ...results.flatMap((r) => (r.data ?? []) as Transaction[]),
      ...(flex.data ?? []).map(flexAsTransaction).filter((t) => t !== null),
    ],
    allExpenses,
  );

  // Ticks and category overrides are kept per transaction; a suggestion counts
  // as ticked until the user unticks it.
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [categories, setCategories] = useState<Record<string, TravelCategory>>({});
  const [splits, setSplits] = useState<Record<string, number>>({});
  const [view, setView] = useState<View>("suggested");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const isTicked = (c: LinkCandidate) => !c.linkedTripId && (ticked[c.ref] ?? false);
  const linkedLabel = (c: LinkCandidate) =>
    c.linkedTripId === trip.id
      ? "Already on this trip"
      : `Linked to ${trips.find((t) => t.id === c.linkedTripId)?.name ?? "another trip"}`;
  const categoryOf = (c: LinkCandidate) => categories[c.ref] ?? c.guess;

  const q = query.trim().toLowerCase();
  const shown = candidates.filter(
    (c) => (view === "all" || c.reason || c.linkedTripId === trip.id) && (!q || c.description.toLowerCase().includes(q)),
  );
  // Suggested keeps suggestions grouped first; Everything is a plain timeline.
  if (view === "all") shown.sort((a, b) => b.date.localeCompare(a.date));
  const selected = candidates.filter(isTicked);
  const duringOpen = candidates.filter((c) => c.reason === "during" && !c.linkedTripId);
  const allDuringTicked = duringOpen.length > 0 && duringOpen.every(isTicked);
  const toggleDuring = () =>
    setTicked((t) => ({ ...t, ...Object.fromEntries(duringOpen.map((c) => [c.ref, !allDuringTicked])) }));
  const splitFor = (c: LinkCandidate) => splits[c.ref] ?? 1;
  // Your share of what's ticked — what the trip total will go up by.
  const total = selected.reduce((s, c) => s + c.amount / splitFor(c), 0);

  const link = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    try {
      await onLink(
        selected.map((c) => ({
          // The server finds a linked transaction by tx_ref, so a repeat link
          // updates the existing expense whatever id is sent here.
          id: newTravelId(),
          trip_id: trip.id,
          tx_ref: c.ref,
          date: c.date,
          description: c.description,
          category: categoryOf(c),
          amount: c.amount,
          currency: "GBP",
          split: splitFor(c),
        })),
      );
    } catch {
      setSaving(false);
    }
  };

  const seg = (active: boolean) =>
    `rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
      active ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white" : "text-gray-500 dark:text-gray-400"
    }`;

  return (
    <TravelDialog title="Link bank transactions" onClose={onCancel} wide>
      {!range ? (
        <p className="py-8 text-center text-sm text-gray-400">Give the trip dates first — that's how we find the right transactions.</p>
      ) : (
        <>
          <p className="mt-1 text-xs text-gray-400">
            Card and Flex spend from {LINK_DAYS_BEFORE} days before the trip to {LINK_DAYS_AFTER} days
            after.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/50">
              <button onClick={() => setView("suggested")} className={seg(view === "suggested")}>Suggested</button>
              <button onClick={() => setView("all")} className={seg(view === "all")}>Everything</button>
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search merchants…"
              className="min-w-0 flex-1 basis-40 rounded-lg border border-gray-200 bg-transparent px-3 py-1.5 text-sm focus:border-sky-400 focus:outline-none dark:border-gray-600"
            />
          </div>

          {duringOpen.length > 0 && (
            <button
              onClick={toggleDuring}
              className="mt-2 text-xs font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {allDuringTicked ? "Untick" : "Tick"} all {duringOpen.length} during the trip
            </button>
          )}

          <div className="-mx-4 mt-3 max-h-[50vh] overflow-y-auto border-y border-gray-100 dark:border-gray-700 md:max-h-[55vh]">
            {loading ? (
              <div className="flex justify-center p-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              </div>
            ) : failed ? (
              <p className="p-6 text-center text-sm text-red-500">Couldn't load transactions: {String(failed)}</p>
            ) : shown.length === 0 ? (
              <p className="p-8 text-center text-sm text-gray-400">
                {view === "suggested" ? "No suggestions — try “Everything”." : "No card spend in this window."}
              </p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-700/60">
                {shown.map((c) => (
                  <li
                    key={c.ref}
                    className={`px-4 py-2.5 ${c.linkedTripId ? "opacity-50" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"} ${isTicked(c) ? "bg-sky-50/50 dark:bg-sky-950/20" : ""}`}
                    onClick={() => !c.linkedTripId && setTicked((t) => ({ ...t, [c.ref]: !isTicked(c) }))}
                  >
                    <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={!!c.linkedTripId || isTicked(c)}
                      disabled={!!c.linkedTripId}
                      readOnly
                      className="h-4 w-4 shrink-0 accent-sky-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.description}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-gray-400">
                        <span>{formatExpenseDate(c.date)}</span>
                        {c.source === "flex" && (
                          <span className="rounded bg-pink-50 px-1 text-[10px] font-bold text-pink-600 dark:bg-pink-950 dark:text-pink-400">
                            Flex
                          </span>
                        )}
                        {c.linkedTripId ? (
                          <span className="font-semibold text-sky-600 dark:text-sky-400">{linkedLabel(c)}</span>
                        ) : c.reason === "travel" ? (
                          <span className="font-semibold text-violet-600 dark:text-violet-400">Looks like travel</span>
                        ) : c.reason === "during" ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">During trip</span>
                        ) : (
                          <span>{c.subcategory}</span>
                        )}
                      </p>
                    </div>
                    <span className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">{gbp0(c.amount)}</span>
                    </div>
                    {/* Once ticked: how to file it, and whether it's shared */}
                    {isTicked(c) && (
                      <div className="ml-7 mt-2 flex flex-wrap items-center gap-x-4 gap-y-2" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={categoryOf(c)}
                          onChange={(e) => setCategories((m) => ({ ...m, [c.ref]: e.target.value as TravelCategory }))}
                          style={{ color: CATEGORY_COLORS[categoryOf(c)] }}
                          className="rounded-md border border-gray-200 bg-transparent px-1.5 py-1 text-xs font-semibold dark:border-gray-600"
                        >
                          {TRAVEL_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                        <SplitControl compact value={splitFor(c)} onChange={(n) => setSplits((m) => ({ ...m, [c.ref]: n }))} />
                        {splitFor(c) > 1 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            your share <span className="font-bold text-gray-900 dark:text-white">{gbp0(c.amount / splitFor(c))}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className={secondaryBtn}>Cancel</button>
        <button onClick={link} disabled={!selected.length || saving} className={primaryBtn}>
          {saving ? "Linking…" : selected.length ? `Link ${selected.length} · ${gbp0(total)}` : "Link"}
        </button>
      </div>
    </TravelDialog>
  );
}
