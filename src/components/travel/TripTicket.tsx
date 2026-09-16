import type { Trip } from "../../types/travel";
import { PlaneArt } from "../HeroArt";
import {
  daysElapsed,
  formatTripDates,
  tripDays,
  tripCurrencies,
  tripStatus,
  type TripSummary,
} from "../../lib/travel";

const STATUS_LABEL = { ongoing: "On now", upcoming: "Upcoming", past: "Completed", undated: "No dates yet" } as const;

/** Budget used, as a ring. Goes rose once it's over. */
function BudgetRing({ spent, budget }: { spent: number; budget: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const pct = budget > 0 ? Math.min(1, spent / budget) : 0;
  const over = budget > 0 && spent > budget;
  return (
    <svg viewBox="0 0 72 72" className="h-16 w-16 shrink-0 -rotate-90 sm:h-[72px] sm:w-[72px]" aria-hidden>
      <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-white/20" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        className={`transition-[stroke-dashoffset] duration-700 ${over ? "stroke-rose-300" : "stroke-white"}`}
      />
    </svg>
  );
}

/** One dot per day of the trip — filled once it has happened, ringed for today. */
function DayDots({ trip }: { trip: Trip }) {
  const days = tripDays(trip);
  const elapsed = daysElapsed(trip);
  const ongoing = tripStatus(trip) === "ongoing";
  if (!days) return null;
  if (days > 21) {
    return (
      <div className="h-1.5 w-full max-w-[14rem] overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white" style={{ width: `${(elapsed / days) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Day ${elapsed} of ${days}`}>
      {Array.from({ length: days }, (_, i) => (
        <span
          key={i}
          className={`h-2 w-2 rounded-full ${
            i < elapsed ? "bg-white" : "bg-white/25"
          } ${ongoing && i === elapsed - 1 ? "ring-2 ring-white/50 ring-offset-1 ring-offset-transparent" : ""}`}
        />
      ))}
    </div>
  );
}

function Field({ label, value, className = "" }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

/** The trip as a boarding pass: details on the left, the money on the tear-off stub. */
export default function TripTicket({
  trip,
  summary,
  money,
  displayCode,
  onDisplayChange,
  onEdit,
  onDelete,
}: {
  trip: Trip;
  summary: TripSummary;
  /** Formats a pound amount in the currency picked for viewing. */
  money: (gbp: number) => string;
  displayCode: string;
  onDisplayChange: (code: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = tripStatus(trip);
  const days = tripDays(trip);
  const elapsed = daysElapsed(trip);
  const left = trip.budget - summary.total;
  const over = trip.budget > 0 && left < 0;
  const locals = tripCurrencies(trip);
  const viewCodes = ["GBP", ...locals.map((c) => c.code)];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-500 via-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 dark:from-sky-700 dark:via-indigo-700 dark:to-violet-800 dark:shadow-none">
      {/* Flight path */}
      <svg viewBox="0 0 400 160" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full text-white/15" aria-hidden>
        <path d="M-10 140 C 120 20, 260 20, 410 90" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 6" />
      </svg>

      <PlaneArt className="-right-4 top-6 h-44 w-44 md:right-72 md:top-2 md:h-52 md:w-52" />

      <div className="relative flex flex-col md:flex-row">
        {/* Main part */}
        <div className="flex-1 p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              {STATUS_LABEL[status]}
            </span>
            <div className="flex gap-1">
              <button onClick={onEdit} className="rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur hover:bg-white/25">
                Edit
              </button>
              <button
                onClick={onDelete}
                title="Delete trip"
                aria-label={`Delete ${trip.name}`}
                className="rounded-lg bg-white/15 px-2 py-1 backdrop-blur hover:bg-rose-500/60"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-3.5 w-3.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          <h1 className="mt-3 break-words text-3xl sm:mt-4 font-extrabold leading-tight tracking-tight sm:text-4xl">{trip.name}</h1>
          {trip.destination && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-white/80">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                <path fillRule="evenodd" d="m9.69 18.933.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 0 0 .281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 1 0 3 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 0 0 2.273 1.765 11.842 11.842 0 0 0 .976.544l.062.029.018.008.006.003ZM10 11.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
              </svg>
              {trip.destination}
            </p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:mt-6 sm:grid-cols-3">
            <Field label="Dates" value={<span className="block truncate">{formatTripDates(trip)}</span>} />
            <Field
              label="Day"
              value={!days ? "—" : status === "ongoing" ? `${elapsed} of ${days}` : `${days} day${days === 1 ? "" : "s"}`}
            />
            <Field
              className="col-span-2 sm:col-span-1"
              label={locals.length ? "£1 buys" : "Exchange"}
              value={
                locals.length ? (
                  <span className="flex flex-wrap gap-x-3">
                    {locals.map((c) => (
                      <span key={c.code} className="whitespace-nowrap tabular-nums">
                        {c.rate} <span className="text-white/70">{c.code}</span>
                      </span>
                    ))}
                  </span>
                ) : (
                  "Pounds"
                )
              }
            />
          </div>
          <div className="mt-3 sm:mt-4">
            <DayDots trip={trip} />
          </div>
        </div>

        {/* Perforation — horizontal on phones, vertical beside the stub on desktop */}
        <div className="relative h-0 md:h-auto md:w-0" aria-hidden>
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-gray-50 dark:bg-gray-950 md:-left-3 md:-top-3" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-gray-50 dark:bg-gray-950 md:-bottom-3 md:-left-3 md:right-auto md:top-auto" />
          <span className="absolute inset-x-5 top-0 border-t-2 border-dashed border-white/30 md:inset-x-auto md:inset-y-5 md:left-0 md:top-5 md:border-l-2 md:border-t-0" />
        </div>

        {/* Stub */}
        <div className="flex items-end gap-4 p-5 sm:p-7 md:w-72 md:flex-col md:items-start md:justify-center">
          <div className="min-w-0 flex-1 md:flex-none">
            {viewCodes.length > 1 && (
              <div className="mb-3 flex w-fit gap-0.5 rounded-lg bg-white/15 p-0.5" role="group" aria-label="Show amounts in">
                {viewCodes.map((c) => (
                  <button
                    key={c}
                    onClick={() => onDisplayChange(c)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                      c === displayCode ? "bg-white text-indigo-600" : "text-white/80 hover:bg-white/10"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">
              {summary.owed >= 0.5 ? "Your share so far" : "Spent so far"}
            </p>
            <p className="mt-1 text-3xl font-extrabold tabular-nums tracking-tight sm:text-4xl">{money(summary.total)}</p>
            <p className="mt-1 text-xs text-white/70">{money(summary.perDay)} a day on the ground</p>
            {summary.prepaid > 0 && (
              <p className="text-xs text-white/50">{money(summary.prepaid)} on flights & stays</p>
            )}
            {summary.owed >= 0.5 && (
              <p className="mt-1.5 inline-block rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold">
                {money(summary.owed)} to collect from splits
              </p>
            )}
          </div>
          {trip.budget > 0 && (
            <div className="flex items-center gap-3">
              <BudgetRing spent={summary.total} budget={trip.budget} />
              <div className="text-xs">
                <p className={`text-base font-bold tabular-nums ${over ? "text-rose-200" : ""}`}>{money(Math.abs(left))}</p>
                <p className="text-white/70">{over ? "over budget" : "left"}</p>
                <p className="hidden text-white/50 sm:block">of {money(trip.budget)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
