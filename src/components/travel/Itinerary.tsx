import type { Trip, TripExpense } from "../../types/travel";
import { CATEGORY_COLORS, expenseCurrency, localMoney, shareGbp, splitOf, todayIso, toGbp, tripDays } from "../../lib/travel";

interface Group {
  key: string;
  /** Big marker in the timeline gutter: "D3", "✈", "·" … */
  marker: string;
  title: string;
  subtitle: string;
  expenses: TripExpense[];
  total: number;
  isToday: boolean;
}

const DAY_MS = 86_400_000;
const utc = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const longDate = (d: string) =>
  new Date(utc(d)).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/**
 * Buckets expenses into the story of the trip: bookings before it, each day of
 * it (newest first), anything after, and anything undated.
 */
function groupExpenses(trip: Trip, expenses: TripExpense[]): Group[] {
  const today = todayIso();
  const end = trip.end_date || trip.start_date;
  const buckets = new Map<string, TripExpense[]>();
  const add = (key: string, e: TripExpense) => buckets.set(key, [...(buckets.get(key) ?? []), e]);
  for (const e of expenses) {
    if (!e.date) add("undated", e);
    else if (!trip.start_date) add(e.date, e);
    else if (e.date < trip.start_date) add("before", e);
    else if (e.date > end) add("after", e);
    else add(e.date, e);
  }

  const sum = (list: TripExpense[]) => list.reduce((s, e) => s + shareGbp(e, trip), 0);
  const byNewest = (a: TripExpense, b: TripExpense) =>
    b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at);
  const groups: Group[] = [];
  const push = (key: string, marker: string, title: string, subtitle: string) => {
    const list = buckets.get(key);
    if (!list) return;
    groups.push({ key, marker, title, subtitle, expenses: [...list].sort(byNewest), total: sum(list), isToday: key === today });
  };

  push("after", "↩", "After the trip", "");
  const dates = [...buckets.keys()].filter((k) => /^\d{4}-/.test(k)).sort().reverse();
  for (const d of dates) {
    const n = trip.start_date ? Math.round((utc(d) - utc(trip.start_date)) / DAY_MS) + 1 : 0;
    const total = tripDays(trip);
    push(
      d,
      n ? `D${n}` : "•",
      d === today ? `Today · ${longDate(d)}` : longDate(d),
      n && total ? `Day ${n} of ${total}` : "",
    );
  }
  push("before", "✈", "Before you go", "Bookings and prep");
  push("undated", "?", "No date", "");
  return groups;
}

export default function Itinerary({
  trip,
  expenses,
  money,
  displayCode,
  onEdit,
  onDelete,
}: {
  trip: Trip;
  expenses: TripExpense[];
  /** Formats a pound amount in the currency picked for viewing. */
  money: (gbp: number) => string;
  displayCode: string;
  onEdit: (e: TripExpense) => void;
  onDelete: (e: TripExpense) => void;
}) {
  const groups = groupExpenses(trip, expenses);
  // Day bars are scaled against the biggest day, ignoring the pre-trip bookings bucket.
  const maxDay = Math.max(1, ...groups.filter((g) => /^\d{4}-/.test(g.key)).map((g) => g.total));

  if (!groups.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-gray-200 px-6 py-14 text-center dark:border-gray-800">
        <p className="text-3xl">🧳</p>
        <p className="mt-3 font-semibold">The journal is empty</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-gray-400">
          Log what you spend as you go, or pull flights and card spend straight from your bank.
        </p>
      </div>
    );
  }

  return (
    <ol className="relative">
      {/* The timeline spine */}
      <span className="absolute bottom-4 left-[1.125rem] top-4 sm:left-[1.375rem] w-px bg-gradient-to-b from-sky-300 via-indigo-200 to-transparent dark:from-sky-700 dark:via-indigo-900" aria-hidden />

      {groups.map((g) => (
        <li key={g.key} className="relative pb-6 pl-11 last:pb-0 sm:pl-14">
          <span
            className={`absolute left-0 top-0 flex h-9 w-9 items-center sm:h-11 sm:w-11 justify-center rounded-2xl text-xs font-extrabold shadow-sm ${
              g.isToday
                ? "bg-gradient-to-br from-sky-500 to-indigo-500 text-white"
                : "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            {g.marker}
          </span>

          <div className="flex min-h-[2.25rem] items-center gap-3 sm:min-h-[2.75rem]">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{g.title}</p>
              <div className="mt-1 flex items-center gap-2">
                {/^\d{4}-/.test(g.key) && (
                  <span className="h-1 w-16 shrink-0 overflow-hidden sm:w-24 rounded-full bg-gray-200/70 dark:bg-gray-800">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                      style={{ width: `${(g.total / maxDay) * 100}%` }}
                    />
                  </span>
                )}
                {g.subtitle && <span className="truncate text-xs text-gray-400">{g.subtitle}</span>}
              </div>
            </div>
            <span className="shrink-0 text-lg font-extrabold tabular-nums tracking-tight">{money(g.total)}</span>
          </div>

          <ul className="mt-2 space-y-1.5">
            {g.expenses.map((e) => (
              <li
                key={e.id}
                onClick={() => onEdit(e)}
                className="group flex cursor-pointer items-center gap-2.5 rounded-2xl bg-white px-2.5 py-2.5 sm:gap-3 sm:px-3 ring-1 ring-gray-100 transition hover:-translate-y-px hover:shadow-md hover:ring-gray-200 dark:bg-gray-900 dark:ring-gray-800 dark:hover:ring-gray-700"
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
                  style={{ backgroundColor: CATEGORY_COLORS[e.category] }}
                  title={e.category}
                >
                  {e.category === "Food & Drink" ? "F&D" : e.category.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{e.description || e.category}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                    <span>{e.category}</span>
                    {splitOf(e) > 1 && (
                      <span className="rounded-full bg-amber-50 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                        split {splitOf(e)}
                      </span>
                    )}
                    {e.tx_ref && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-px text-[10px] font-semibold text-sky-600 dark:bg-sky-950 dark:text-sky-400">
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-2.5 w-2.5">
                          <path d="M8 1 1.5 4.5V6h13V4.5L8 1ZM2.5 7v5h2V7h-2Zm4.5 0v5h2V7H7Zm4.5 0v5h2V7h-2ZM1.5 13v2h13v-2h-13Z" />
                        </svg>
                        {e.tx_ref.startsWith("flex:") ? "Flex" : "Bank"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums">{money(shareGbp(e, trip))}</p>
                  {(() => {
                    // Beneath: the full amount when split, and what was actually
                    // paid when that was in a different currency from the view.
                    const paidIn = expenseCurrency(e, trip);
                    const parts = [
                      splitOf(e) > 1 ? `of ${money(toGbp(e, trip))}` : "",
                      paidIn !== displayCode ? `paid ${localMoney(e.amount, paidIn)}` : "",
                    ].filter(Boolean);
                    return parts.length ? <p className="text-[11px] tabular-nums text-gray-400">{parts.join(" · ")}</p> : null;
                  })()}
                </div>
                <button
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onDelete(e);
                  }}
                  title={e.tx_ref ? "Unlink transaction" : "Delete expense"}
                  aria-label={e.tx_ref ? "Unlink transaction" : "Delete expense"}
                  className="hidden shrink-0 rounded-lg p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500 md:block md:opacity-0 md:group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-950/40"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="h-3.5 w-3.5">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
