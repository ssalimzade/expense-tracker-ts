import { useRef, useState } from "react";
import { TRAVEL_CATEGORIES, type PaidWith, type TravelCategory, type Trip, type TripExpense } from "../../types/travel";
import { paidWith, CATEGORY_COLORS, MAX_DESCRIPTION, expenseCurrency, newTravelId, rateFor, todayIso, toGbp, tripCurrencies } from "../../lib/travel";
import { gbp } from "../../lib/format";
import TravelDialog, { fieldInput, fieldLabel, primaryBtn, secondaryBtn } from "./TravelDialog";
import SplitControl from "./SplitControl";

/** Today when it falls inside the trip, otherwise the trip's first day. */
function defaultDate(trip: Trip) {
  const today = todayIso();
  if (!trip.start_date) return today;
  return today >= trip.start_date && today <= (trip.end_date || trip.start_date) ? today : trip.start_date;
}

const lastCurrencyKey = (tripId: string) => `travel-currency-${tripId}`;

/** The currency last used on this trip, if it's still one of the trip's — else the main one. */
function defaultCurrency(trip: Trip, codes: string[]) {
  let last: string | null = null;
  try {
    last = localStorage.getItem(lastCurrencyKey(trip.id));
  } catch {
    // Storage blocked — fall back to the main currency.
  }
  return last && codes.includes(last) ? last : codes[0];
}

/** Add or edit one expense. When adding, "Add another" saves and clears for the next one. */
export default function ExpenseDialog({
  trip,
  expense,
  onCancel,
  onSave,
  onDelete,
}: {
  trip: Trip;
  expense?: TripExpense;
  onCancel: () => void;
  /** Resolves once saved; rejects (and the error toast shows) if it didn't. */
  onSave: (e: Partial<TripExpense>, keepOpen: boolean) => Promise<void>;
  onDelete?: (e: TripExpense) => void;
}) {
  // The trip's local currencies first, then pounds.
  const codes = [...tripCurrencies(trip).map((c) => c.code), "GBP"];
  // Fixed per draft, so saving the same draft twice updates rather than duplicates.
  const [draftId, setDraftId] = useState(() => expense?.id ?? newTravelId());
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [currency, setCurrency] = useState(() =>
    expense ? expenseCurrency(expense, trip) : defaultCurrency(trip, codes),
  );
  const [description, setDescription] = useState(expense?.description ?? "");
  const [category, setCategory] = useState<TravelCategory>(expense?.category ?? "Food & Drink");
  const [date, setDate] = useState(expense?.date ?? defaultDate(trip));
  const [split, setSplit] = useState(expense?.split ?? 1);
  // Linked Flex/bank expenses already know how they were paid.
  const linked = !!expense?.tx_ref;
  const [paid, setPaid] = useState<PaidWith>(expense ? paidWith(expense) : "card");
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const value = parseFloat(amount.replace(/[^0-9.]/g, ""));
  const valid = Number.isFinite(value) && value > 0;

  const save = async (keepOpen: boolean) => {
    if (!valid || saving) return;
    setSaving(true);
    try {
      await onSave(
      {
        id: draftId,
        trip_id: trip.id,
        amount: value,
        currency,
        description: description.trim(),
        category,
        date,
        split,
        ...(linked ? {} : { paid_with: paid }),
      },
      keepOpen,
      );
    } catch {
      // Keep everything as typed; the toast says it didn't save.
      setSaving(false);
      return;
    }
    setSaving(false);
    try {
      localStorage.setItem(lastCurrencyKey(trip.id), currency);
    } catch {
      // Only a convenience.
    }
    if (keepOpen) {
      setDraftId(newTravelId());
      setAmount("");
      setDescription("");
      setSplit(1);
      amountRef.current?.focus();
    }
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && save(false);

  const seg = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
      active ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-white" : "text-gray-500 dark:text-gray-400"
    }`;

  return (
    <TravelDialog title={expense ? "Edit expense" : "Add expense"} onClose={onCancel}>
      <label className={fieldLabel}>Amount</label>
      <div className="mt-1 flex items-center gap-2">
        <input
          ref={amountRef}
          autoFocus
          inputMode="decimal"
          value={amount}
          placeholder="0"
          onChange={(e) => setAmount(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onEnter}
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-center text-2xl font-semibold tabular-nums focus:border-sky-400 focus:outline-none dark:border-gray-600"
        />
        {codes.length > 1 && (
          <div className="flex shrink-0 flex-wrap gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/50">
            {codes.map((c) => (
              <button key={c} type="button" onClick={() => setCurrency(c)} className={seg(currency === c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      {currency !== "GBP" && valid && (
        <p className="mt-1 text-center text-xs text-gray-400">
          ≈ {gbp(toGbp({ amount: value, in_gbp: false, currency }, trip))} at £1 = {rateFor(trip, currency)} {currency}
        </p>
      )}

      <div className="mt-3 flex min-h-[2rem] flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
        <SplitControl value={split} onChange={setSplit} />
        {split > 1 && valid && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Your share <span className="font-bold text-gray-900 dark:text-white">{gbp(toGbp({ amount: value, in_gbp: false, currency }, trip) / split)}</span>
          </span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Paid with</span>
        {linked ? (
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            {paid === "flex" ? "Flex" : "Card"} · from your bank
          </span>
        ) : (
          <div className="flex gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900/50">
            <button type="button" onClick={() => setPaid("card")} className={seg(paid === "card")}>Card</button>
            <button type="button" onClick={() => setPaid("flex")} className={seg(paid === "flex")}>Flex</button>
          </div>
        )}
      </div>

      <label className={fieldLabel}>What was it?</label>
      <input value={description} maxLength={MAX_DESCRIPTION} placeholder="e.g. Dinner at Time Out Market" onChange={(e) => setDescription(e.target.value)} onKeyDown={onEnter} className={fieldInput} />

      <label className={fieldLabel}>Category</label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {TRAVEL_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            style={category === c ? { backgroundColor: CATEGORY_COLORS[c] } : undefined}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
              category === c ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
            }`}
          >
            {category !== c && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c] }} />}
            {c}
          </button>
        ))}
      </div>

      <label className={fieldLabel}>Date</label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />

      <div className="mt-4 flex gap-2">
        {expense && onDelete ? (
          <button onClick={() => onDelete(expense)} className="rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40">
            Delete
          </button>
        ) : (
          <button onClick={() => save(true)} disabled={!valid || saving} className={`${secondaryBtn} disabled:opacity-40`}>
            Add another
          </button>
        )}
        {expense && <button onClick={onCancel} className={secondaryBtn}>Cancel</button>}
        <button onClick={() => save(false)} disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Saving…" : expense ? "Save" : "Add"}
        </button>
      </div>
    </TravelDialog>
  );
}
