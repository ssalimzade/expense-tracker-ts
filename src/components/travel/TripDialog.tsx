import { useEffect, useState } from "react";
import type { Trip } from "../../types/travel";
import { fetchRate } from "../../api/travel";
import { MAX_CURRENCIES, MAX_NAME, tripCurrencies } from "../../lib/travel";
import TravelDialog, { fieldInput, fieldLabel, primaryBtn, secondaryBtn } from "./TravelDialog";

const COMMON_CURRENCIES = ["EUR", "USD", "CHF", "AZN", "TRY", "AED", "JPY"];

type RateState =
  | { status: "saved" }
  | { status: "loading" }
  | { status: "live"; asOf: string | null }
  | { status: "failed" };

interface CurrencyDraft {
  code: string;
  rate: string;
  state: RateState;
}

const asOfLabel = (d: string | null) =>
  d ? new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "today";

const parseNum = (s: string) => {
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** Create or edit a trip. */
export default function TripDialog({
  trip,
  usedCurrencies = [],
  onCancel,
  onSave,
}: {
  trip?: Trip;
  /** Currencies this trip's expenses are recorded in — they can't be removed. */
  usedCurrencies?: string[];
  onCancel: () => void;
  /** Resolves once saved; rejects (and the error toast shows) if it didn't. */
  onSave: (trip: Partial<Trip>) => Promise<void>;
}) {
  const [name, setName] = useState(trip?.name ?? "");
  const [destination, setDestination] = useState(trip?.destination ?? "");
  const [start, setStart] = useState(trip?.start_date ?? "");
  const [end, setEnd] = useState(trip?.end_date ?? "");
  const [budget, setBudget] = useState(trip?.budget ? String(trip.budget) : "");
  const [saving, setSaving] = useState(false);
  // Saved currencies keep the rate they were created with; a currency added now
  // looks up today's rate. A new trip starts with euros, the usual case.
  const [currencies, setCurrencies] = useState<CurrencyDraft[]>(() =>
    trip
      ? tripCurrencies(trip).map((c) => ({ code: c.code, rate: String(c.rate), state: { status: "saved" } }))
      : [{ code: "EUR", rate: "", state: { status: "loading" } }],
  );
  const [other, setOther] = useState("");

  const patch = (code: string, change: Partial<CurrencyDraft>) =>
    setCurrencies((list) => list.map((c) => (c.code === code ? { ...c, ...change } : c)));

  // If the currency is removed before this returns, `patch` finds nothing to update.
  const fetchInto = (code: string) =>
    fetchRate(code)
      .then((r) => patch(code, { rate: String(r.rate), state: { status: "live", asOf: r.as_of } }))
      .catch(() => patch(code, { state: { status: "failed" } }));

  const add = (raw: string) => {
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || code === "GBP") return;
    if (currencies.some((c) => c.code === code) || currencies.length >= MAX_CURRENCIES) return;
    // Re-adding one the trip already had brings its saved rate back.
    const saved = trip && tripCurrencies(trip).find((c) => c.code === code);
    const draft: CurrencyDraft = saved
      ? { code, rate: String(saved.rate), state: { status: "saved" } }
      : { code, rate: "", state: { status: "loading" } };
    setCurrencies((list) => (list.some((c) => c.code === code) ? list : [...list, draft]));
    if (!saved) fetchInto(code);
  };

  useEffect(() => {
    if (!trip) fetchInto("EUR");
    // Once, for the euros a new trip starts with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const remove = (code: string) => setCurrencies((list) => list.filter((c) => c.code !== code));
  const toggle = (code: string) => (currencies.some((c) => c.code === code) ? remove(code) : add(code));

  const loading = currencies.some((c) => c.state.status === "loading");
  const missingRate = currencies.filter((c) => c.state.status !== "loading" && !(parseNum(c.rate) > 0));
  const problems = [
    !name.trim() && "a trip name",
    missingRate.length > 0 && `an exchange rate for ${missingRate.map((c) => c.code).join(", ")}`,
  ].filter(Boolean) as string[];
  const valid = problems.length === 0 && !loading;

  const save = async () => {
    if (!valid || saving) return;
    setSaving(true);
    // On failure the dialog stays open with everything as typed.
    await onSave({
      ...(trip ? { id: trip.id } : {}),
      name: name.trim(),
      destination: destination.trim(),
      start_date: start,
      end_date: end || start,
      currencies: currencies.map((c) => ({ code: c.code, rate: parseNum(c.rate) })),
      budget: parseNum(budget),
    }).catch(() => setSaving(false));
  };
  const onEnter = (e: React.KeyboardEvent) => e.key === "Enter" && save();

  return (
    <TravelDialog title={trip ? "Edit trip" : "New trip"} onClose={onCancel}>
      <label className={fieldLabel}>Trip name</label>
      <input autoFocus value={name} maxLength={MAX_NAME} placeholder="e.g. Lisbon long weekend" onChange={(e) => setName(e.target.value)} onKeyDown={onEnter} className={fieldInput} />

      <label className={fieldLabel}>Destination</label>
      <input value={destination} maxLength={MAX_NAME} placeholder="e.g. Portugal" onChange={(e) => setDestination(e.target.value)} onKeyDown={onEnter} className={fieldInput} />

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className={fieldLabel}>From</label>
          <input
            type="date"
            value={start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(v);
              // Clearing the start clears the end too — a trip is dated fully or not at all.
              if (!v || !end || end < v) setEnd(v);
            }}
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>To</label>
          <input type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className={fieldInput} />
        </div>
      </div>

      <label className={fieldLabel}>Local currencies (pounds always available)</label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {[...COMMON_CURRENCIES, ...currencies.map((c) => c.code).filter((c) => !COMMON_CURRENCIES.includes(c))].map((c) => {
          const on = currencies.some((x) => x.code === c);
          const locked = on && usedCurrencies.includes(c);
          const full = !on && currencies.length >= MAX_CURRENCIES;
          return (
            <button
              key={c}
              type="button"
              onClick={() => !locked && !full && toggle(c)}
              disabled={full}
              title={locked ? `Expenses are recorded in ${c}, so it stays` : full ? `Up to ${MAX_CURRENCIES} currencies` : undefined}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-40 ${
                on
                  ? `bg-sky-600 text-white ${locked ? "cursor-default" : ""}`
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {on && "✓ "}
              {c}
              {locked && (
                <svg viewBox="0 0 16 16" fill="currentColor" className="ml-1 inline h-2.5 w-2.5 -translate-y-px opacity-80" aria-label="locked">
                  <path d="M5 7V5a3 3 0 1 1 6 0v2h.5A1.5 1.5 0 0 1 13 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-5A1.5 1.5 0 0 1 4.5 7H5Zm1.5 0h3V5a1.5 1.5 0 0 0-3 0v2Z" />
                </svg>
              )}
            </button>
          );
        })}
        <input
          value={other}
          placeholder="Other"
          maxLength={3}
          onChange={(e) => setOther(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(other);
              setOther("");
            }
          }}
          onBlur={() => {
            if (other.length === 3) add(other);
            setOther("");
          }}
          className="w-16 rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-center text-xs font-semibold uppercase focus:border-sky-400 focus:outline-none dark:border-gray-600"
        />
      </div>

      {currencies.some((c) => usedCurrencies.includes(c.code)) && (
        <p className="mt-1.5 text-[11px] text-gray-400">
          🔒 {currencies.filter((c) => usedCurrencies.includes(c.code)).map((c) => c.code).join(", ")} can't be removed —
          some expenses are recorded in it.
        </p>
      )}

      {currencies.length > 0 && (
        <div className="mt-3 space-y-2">
          {currencies.map((c, i) => (
            <div key={c.code} className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500">£1 =</span>
                <input
                  inputMode="decimal"
                  value={c.rate}
                  placeholder={c.state.status === "loading" ? "Fetching…" : "rate"}
                  onChange={(e) => patch(c.code, { rate: e.target.value })}
                  onKeyDown={onEnter}
                  className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-right font-semibold tabular-nums focus:border-sky-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800"
                />
                <span className="font-semibold">{c.code}</span>
                {i === 0 && currencies.length > 1 && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-gray-400">main</span>
                )}
              </div>
              <p className={`mt-1 text-[11px] ${c.state.status === "failed" ? "text-amber-600 dark:text-amber-400" : "text-gray-400"}`}>
                {c.state.status === "loading" && "Fetching today's rate…"}
                {c.state.status === "live" && `Today's rate, as of ${asOfLabel(c.state.asOf)} — saved with the trip, won't change by itself.`}
                {c.state.status === "failed" && "Couldn't fetch a rate — enter it manually."}
                {c.state.status === "saved" && "Rate saved with the trip."}
              </p>
            </div>
          ))}
          {currencies.some((c) => c.state.status === "live") && (
            <p className="text-[11px] text-gray-400">
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="underline">
                Rates by Exchange Rate API
              </a>
            </p>
          )}
        </div>
      )}

      <label className={fieldLabel}>Budget (£, optional)</label>
      <input inputMode="decimal" value={budget} placeholder="e.g. 800" onChange={(e) => setBudget(e.target.value)} onKeyDown={onEnter} className={fieldInput} />

      {problems.length > 0 && name.trim() && (
        <p className="mt-3 text-xs text-red-500">Still needed: {problems.join(", ")}.</p>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onCancel} className={secondaryBtn}>Cancel</button>
        <button onClick={save} disabled={!valid || saving} className={primaryBtn}>
          {saving ? "Saving…" : trip ? "Save trip" : "Create trip"}
        </button>
      </div>
    </TravelDialog>
  );
}
