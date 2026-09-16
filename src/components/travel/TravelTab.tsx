import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRepayments } from "../../api/repayments";
import {
  useDeleteTrip,
  useDeleteTripExpense,
  useLinkTransactions,
  useRestoreTripExpenses,
  useSaveTrip,
  useSaveTripExpense,
  useSaveTripPlanLine,
  useTravel,
} from "../../hooks/useTravel";
import type { Trip, TripExpense } from "../../types/travel";
import { paidWith, defaultTrip, displayMoney, expenseCurrency, newTravelId, shareGbp, sortTrips, summarize, tripCurrencies, tripStatus } from "../../lib/travel";
import { gbp0 } from "../../lib/format";
import { toast } from "../../lib/toast";
import { QueryState } from "../common";
import TripDialog from "./TripDialog";
import ExpenseDialog from "./ExpenseDialog";
import LinkTransactionsDialog from "./LinkTransactionsDialog";
import TripTicket from "./TripTicket";
import Itinerary from "./Itinerary";
import CategoryStrip from "./CategoryStrip";
import TripPlan from "./TripPlan";
import PaymentStrip from "./PaymentStrip";

const TRIP_STORAGE_KEY = "travel-trip";
const VIEW_STORAGE_KEY = "travel-view";
const DISPLAY_STORAGE_KEY = "travel-display";
type View = "journal" | "plan";

const shortRange = (t: Trip) => {
  if (!t.start_date) return "No dates";
  const f = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return t.end_date && t.end_date !== t.start_date ? `${f(t.start_date)} – ${f(t.end_date)}` : f(t.start_date);
};

type ExpenseEditor = { expense?: TripExpense } | null;

export default function TravelTab() {
  const travel = useTravel();
  const saveTrip = useSaveTrip();
  const removeTrip = useDeleteTrip();
  const saveExpense = useSaveTripExpense();
  const saveExpenses = useLinkTransactions();
  const restoreExpenses = useRestoreTripExpenses();
  const removeExpense = useDeleteTripExpense();
  const savePlanLine = useSaveTripPlanLine();

  const [selectedId, setSelectedId] = useState<string | null>(() => localStorage.getItem(TRIP_STORAGE_KEY));
  const [tripEditor, setTripEditor] = useState<{ trip?: Trip } | null>(null);
  const [expenseEditor, setExpenseEditor] = useState<ExpenseEditor>(null);
  const [linking, setLinking] = useState(false);
  const [view, setView] = useState<View>(() =>
    localStorage.getItem(VIEW_STORAGE_KEY) === "plan" ? "plan" : "journal",
  );
  const [displayPref, setDisplayPref] = useState(() => localStorage.getItem(DISPLAY_STORAGE_KEY) ?? "GBP");
  const changeDisplay = (code: string) => {
    setDisplayPref(code);
    localStorage.setItem(DISPLAY_STORAGE_KEY, code);
  };
  const changeView = (v: View) => {
    setView(v);
    localStorage.setItem(VIEW_STORAGE_KEY, v);
  };

  const select = (id: string) => {
    setSelectedId(id);
    localStorage.setItem(TRIP_STORAGE_KEY, id);
  };

  const allExpenses = travel.data?.expenses ?? [];
  const trips = sortTrips(travel.data?.trips ?? []);
  const trip = trips.find((t) => t.id === selectedId) ?? defaultTrip(trips);
  const expenses = trip ? allExpenses.filter((e) => e.trip_id === trip.id) : [];
  const summary = trip ? summarize(trip, expenses) : null;
  // Flex repayment schedule — only fetched when this trip has Flex spend. Same
  // cache entry as the Repayments tab.
  const repayments = useQuery({
    queryKey: ["repayments"],
    queryFn: fetchRepayments,
    enabled: expenses.some((e) => paidWith(e) === "flex"),
  });
  // View amounts in pounds or one of this trip's currencies; a choice that isn't
  // one of this trip's falls back to pounds.
  const displayCode =
    trip && tripCurrencies(trip).some((c) => c.code === displayPref) ? displayPref : "GBP";
  const money = (gbp: number) => (trip ? displayMoney(gbp, trip, displayCode) : "");

  // Dialogs stay open until the save lands, so a failed request (patchy signal
  // abroad) leaves what you typed on screen to retry rather than discarding it.
  const onSaveTrip = async (t: Partial<Trip>) => {
    const id = t.id ?? newTravelId();
    await saveTrip.mutateAsync({ ...t, id });
    if (!t.id) select(id);
    setTripEditor(null);
  };

  // Undo replays a snapshot from before the delete, so it goes through restore
  // mode: anything re-used since (e.g. the transaction was linked to another
  // trip in the meantime) stays where it is, and the user is told.
  const restore = (snapshot: TripExpense[]) =>
    restoreExpenses.mutate(snapshot, {
      onSuccess: (data) => {
        const back = snapshot.filter((e) => data.expenses.some((x) => x.id === e.id)).length;
        if (back < snapshot.length) {
          toast.error(
            back ? `Restored ${back} of ${snapshot.length} — the rest were re-used since` : "Couldn't undo — it's been re-used since",
          );
        }
      },
    });

  const onDeleteTrip = (t: Trip) => {
    const own = allExpenses.filter((e) => e.trip_id === t.id);
    const detail = own.length ? ` and its ${own.length} expense${own.length === 1 ? "" : "s"}` : "";
    if (!window.confirm(`Delete "${t.name}"${detail}?`)) return;
    removeTrip.mutate(t.id, {
      onSuccess: () =>
        toast.undo(`Deleted ${t.name}`, () => {
          // Travel mutations share a scope, so these replay in order: trip first.
          saveTrip.mutate(t);
          if (own.length) restore(own);
        }),
    });
  };

  const onSaveExpense = async (e: Partial<TripExpense>, keepOpen: boolean) => {
    await saveExpense.mutateAsync(e);
    if (!keepOpen) setExpenseEditor(null);
  };

  const onDeleteExpense = (e: TripExpense) => {
    setExpenseEditor(null);
    removeExpense.mutate(e.id, {
      onSuccess: () =>
        toast.undo(e.tx_ref ? "Transaction unlinked" : "Expense deleted", () => restore([e])),
    });
  };

  const onLink = async (linked: Partial<TripExpense>[]) => {
    await saveExpenses.mutateAsync(linked);
    setLinking(false);
    toast.success(`Linked ${linked.length} transaction${linked.length === 1 ? "" : "s"}`);
  };

  return (
    <QueryState isLoading={travel.isLoading} error={travel.error}>
      <div className="mx-auto max-w-6xl space-y-5">
        {trips.length === 0 ? (
          <EmptyState onNew={() => setTripEditor({})} />
        ) : (
          trip &&
          summary && (
            <>
              <TripSwitcher
                trips={trips}
                activeId={trip.id}
                totals={Object.fromEntries(
                  trips.map((t) => [
                    t.id,
                    allExpenses.filter((e) => e.trip_id === t.id).reduce((s, e) => s + shareGbp(e, t), 0),
                  ]),
                )}
                onSelect={select}
                onNew={() => setTripEditor({})}
              />

              <TripTicket
                trip={trip}
                summary={summary}
                money={money}
                displayCode={displayCode}
                onDisplayChange={changeDisplay}
                onEdit={() => setTripEditor({ trip })}
                onDelete={() => onDeleteTrip(trip)}
              />

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <aside className="space-y-4 lg:sticky lg:top-5 lg:order-last lg:self-start">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setExpenseEditor({})}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-gray-900 px-3 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                    >
                      <span className="text-lg leading-none">+</span> Expense
                    </button>
                    <button
                      onClick={() => setLinking(true)}
                      className="flex items-center justify-center gap-1.5 rounded-2xl bg-white px-3 py-3 text-sm font-semibold text-gray-700 ring-1 ring-gray-200 transition hover:ring-sky-300 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                    >
                      <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 text-sky-500">
                        <path d="M8 1 1.5 4.5V6h13V4.5L8 1ZM2.5 7v5h2V7h-2Zm4.5 0v5h2V7H7Zm4.5 0v5h2V7h-2ZM1.5 13v2h13v-2h-13Z" />
                      </svg>
                      From bank
                    </button>
                  </div>
                  <CategoryStrip summary={summary} money={money} />
                  <PaymentStrip trip={trip} expenses={expenses} summary={summary} repayments={repayments.data} money={money} />
                </aside>

                <div className="min-w-0 space-y-4">
                  <div className="flex w-fit gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/70">
                    {(["journal", "plan"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => changeView(v)}
                        className={`rounded-xl px-4 py-1.5 text-sm font-semibold capitalize transition ${
                          view === v
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {view === "journal" ? (
                    <Itinerary
                      trip={trip}
                      expenses={expenses}
                      money={money}
                      displayCode={displayCode}
                      onEdit={(expense) => setExpenseEditor({ expense })}
                      onDelete={onDeleteExpense}
                    />
                  ) : (
                    <TripPlan
                      // Per trip: its unsaved per-day choices mustn't follow you to another trip.
                      key={trip.id}
                      trip={trip}
                      summary={summary}
                      onSaveLine={(line) => savePlanLine.mutate({ tripId: trip.id, ...line })}
                      onUseAsBudget={(budget) => saveTrip.mutate({ ...trip, plan: undefined, budget })}
                    />
                  )}
                </div>
              </div>
            </>
          )
        )}
      </div>

      {tripEditor && (
        <TripDialog
          trip={tripEditor.trip}
          usedCurrencies={
            tripEditor.trip
              ? [...new Set(allExpenses.filter((e) => e.trip_id === tripEditor.trip!.id).map((e) => expenseCurrency(e, tripEditor.trip!)))]
              : []
          }
          onCancel={() => setTripEditor(null)}
          onSave={onSaveTrip}
        />
      )}
      {expenseEditor && trip && (
        <ExpenseDialog
          trip={trip}
          expense={expenseEditor.expense}
          onCancel={() => setExpenseEditor(null)}
          onSave={onSaveExpense}
          onDelete={onDeleteExpense}
        />
      )}
      {linking && trip && (
        <LinkTransactionsDialog
          trip={trip}
          trips={trips}
          allExpenses={allExpenses}
          onCancel={() => setLinking(false)}
          onLink={onLink}
        />
      )}
    </QueryState>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 px-6 py-16 text-center text-white dark:from-sky-700 dark:via-indigo-700 dark:to-violet-800 sm:py-24">
      <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-white/20" aria-hidden>
        <path d="M-10 150 C 120 10, 280 10, 410 120" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
      </svg>
      <div className="relative">
        <p className="text-5xl">🌍</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">Where to next?</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-white/80">
          Create a trip to keep a day-by-day journal of what you spend — in the local currency, with
          flights and card spend pulled straight from your bank.
        </p>
        <button
          onClick={onNew}
          className="mt-6 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-indigo-600 shadow-lg transition hover:scale-[1.02]"
        >
          Plan a trip
        </button>
      </div>
    </section>
  );
}

function TripSwitcher({
  trips,
  activeId,
  totals,
  onSelect,
  onNew,
}: {
  trips: Trip[];
  activeId: string;
  totals: Record<string, number>;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
      {trips.map((t) => {
        const active = t.id === activeId;
        const ongoing = tripStatus(t) === "ongoing";
        return (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-left transition ${
              active
                ? "bg-gray-900 text-white shadow-md dark:bg-white dark:text-gray-900"
                : "bg-white text-gray-700 ring-1 ring-gray-200 hover:ring-gray-300 dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-800"
            }`}
          >
            <span className="flex items-center gap-1.5 text-sm font-bold">
              {ongoing && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
              {t.name}
            </span>
            <span className={`mt-0.5 block text-xs tabular-nums ${active ? "opacity-70" : "text-gray-400"}`}>
              {shortRange(t)} · {gbp0(totals[t.id] ?? 0)}
            </span>
          </button>
        );
      })}
      <button
        onClick={onNew}
        className="shrink-0 rounded-2xl border-2 border-dashed border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-400 transition hover:border-sky-300 hover:text-sky-600 dark:border-gray-800"
      >
        + New trip
      </button>
    </div>
  );
}
