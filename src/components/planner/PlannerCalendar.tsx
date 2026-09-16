import { useState, useEffect, useRef } from "react";

interface BankHoliday {
  title: string;
  date: string;
}

const CACHE_KEY = "uk-bank-holidays-v1";
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function loadBankHolidays(): Promise<BankHoliday[]> {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    }
    const res = await fetch("https://www.gov.uk/bank-holidays.json");
    const json = await res.json();
    const data: BankHoliday[] = (json["england-and-wales"].events as { title: string; date: string }[]).map(
      (e) => ({ title: e.title, date: e.date }),
    );
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch {
    return [];
  }
}

const DOW_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface Props {
  month: string;
  daysOff: Set<number>;
  onToggleDay: (day: number) => void;
  /** Working days and weekday bank holidays, once the holidays are known. */
  onStats?: (s: { workingDays: number; bankHolidays: number }) => void;
}

export default function PlannerCalendar({ month, daysOff, onToggleDay, onStats }: Props) {
  const [holTitles, setHolTitles] = useState<Record<string, string>>({});
  const [holDates, setHolDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadBankHolidays().then((holidays) => {
      const inMonth = holidays.filter((h) => h.date.startsWith(month));
      setHolDates(new Set(inMonth.map((h) => h.date)));
      setHolTitles(Object.fromEntries(inMonth.map((h) => [h.date, h.title])));
    });
  }, [month]);

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();

  // Mon-based offset: (getDay() + 6) % 7 → Mon=0 … Sun=6
  const firstDow = (new Date(year, monthNum - 1, 1).getDay() + 6) % 7;

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Stats
  let bankHolCount = 0;
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = (new Date(year, monthNum - 1, d).getDay() + 6) % 7;
    const isWeekend = dow >= 5;
    const dateStr = `${month}-${String(d).padStart(2, "0")}`;
    const isBankHol = holDates.has(dateStr);
    const isDayOff = daysOff.has(d);
    if (isBankHol && !isWeekend) bankHolCount++;
    if (!isWeekend && !isBankHol && !isDayOff) workingDays++;
  }

  const statsRef = useRef(onStats);
  statsRef.current = onStats;
  useEffect(() => {
    statsRef.current?.({ workingDays, bankHolidays: bankHolCount });
  }, [workingDays, bankHolCount]);

  const holidays = Object.entries(holTitles).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="rounded-3xl bg-white p-4 ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 sm:p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Days off</p>
        <p className="text-[11px] text-gray-400">Tap a weekday</p>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1">
        {DOW_LABELS.map((d, i) => (
          <div
            key={i}
            className={`pb-1 text-center text-[10px] font-bold ${i >= 5 ? "text-gray-300 dark:text-gray-600" : "text-gray-400"}`}
          >
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} />;
          const dow = (new Date(year, monthNum - 1, day).getDay() + 6) % 7;
          const isWeekend = dow >= 5;
          const dateStr = `${month}-${String(day).padStart(2, "0")}`;
          const isBankHol = holDates.has(dateStr);
          const isDayOff = daysOff.has(day);
          const isToday = dateStr === todayStr;
          const clickable = !isWeekend && !isBankHol;

          let tile = "bg-gray-50 text-gray-700 hover:bg-[#8ea3c7]/15 hover:text-[#40527a] dark:bg-gray-800/60 dark:text-gray-200 dark:hover:bg-[#8ea3c7]/15 dark:hover:text-[#c9d4e8]";
          if (isDayOff) tile = "bg-gradient-to-br from-[#7c91b6] to-[#51658a] text-white shadow-sm";
          else if (isBankHol) tile = "bg-[#c8b58f]/25 text-[#6e5836] dark:bg-[#c8b58f]/15 dark:text-[#d9c59e]";
          else if (isWeekend) tile = "text-gray-300 dark:text-gray-600";

          return (
            <button
              key={day}
              type="button"
              disabled={!clickable}
              onClick={() => onToggleDay(day)}
              title={isBankHol ? holTitles[dateStr] : isDayOff ? "Day off — tap to undo" : undefined}
              aria-pressed={clickable ? isDayOff : undefined}
              className={`relative flex aspect-square items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition disabled:cursor-default ${tile} ${
                isToday ? "ring-2 ring-[#8ea3c7] ring-offset-1 ring-offset-white dark:ring-offset-gray-900" : ""
              }`}
            >
              {day}
              {isBankHol && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-[#b39767]" />}
            </button>
          );
        })}
      </div>

      {holidays.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
          {holidays.map(([date, title]) => (
            <li key={date} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b39767]" />
              <span className="w-12 tabular-nums text-gray-400">
                {new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
              </span>
              <span className="text-gray-600 dark:text-gray-300">{title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
