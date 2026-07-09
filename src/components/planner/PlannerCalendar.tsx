import { useState, useEffect } from "react";
import { Card } from "../common";
import { formatMonthLabel } from "../../lib/format";

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

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  month: string;
  daysOff: Set<number>;
  onToggleDay: (day: number) => void;
}

export default function PlannerCalendar({ month, daysOff, onToggleDay }: Props) {
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

  return (
    <Card className="max-md:!p-2.5">
      <div className="space-y-4 max-md:space-y-2.5">
        {/* Header: month name + stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 max-md:gap-1.5">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 max-md:text-base">{formatMonthLabel(month)}</h2>
          <div className="flex gap-2 text-xs">
            <span className="rounded-md bg-teal-50 px-2.5 py-1 font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
              {daysOff.size} days off
            </span>
            <span className="rounded-md bg-amber-50 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              {bankHolCount} bank holidays
            </span>
            <span className="rounded-md bg-indigo-50 px-2.5 py-1 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {workingDays} working days
            </span>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/60">
            {DOW_LABELS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-semibold uppercase tracking-wider max-md:py-1 max-md:text-[10px] ${
                  i >= 5 ? "text-gray-300 dark:text-gray-600" : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {d}
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {cells.map((day, idx) => {
              if (!day)
                return (
                  <div
                    key={`e${idx}`}
                    className="min-h-[36px] sm:min-h-[78px] border-b border-r border-gray-100 bg-gray-50/40 last:border-r-0 dark:border-gray-800 dark:bg-gray-900/40"
                  />
                );
              const dow = (new Date(year, monthNum - 1, day).getDay() + 6) % 7;
              const isWeekend = dow >= 5;
              const dateStr = `${month}-${String(day).padStart(2, "0")}`;
              const isBankHol = holDates.has(dateStr);
              const isDayOff = daysOff.has(day);
              const isToday = dateStr === todayStr;
              const clickable = !isWeekend && !isBankHol;

              let cellBg = "bg-white dark:bg-gray-900 ";
              if (isDayOff) cellBg = "bg-teal-500 dark:bg-teal-600 ";
              else if (isBankHol) cellBg = "bg-amber-50 dark:bg-amber-950/50 ";
              else if (isWeekend) cellBg = "bg-gray-50 dark:bg-gray-800/40 ";

              return (
                <div
                  key={day}
                  onClick={() => clickable && onToggleDay(day)}
                  title={isBankHol ? holTitles[dateStr] : undefined}
                  className={`relative min-h-[36px] sm:min-h-[78px] border-b border-r border-gray-100 p-1 transition-colors last:border-r-0 max-md:p-0.5 sm:p-1.5 dark:border-gray-800 ${cellBg} ${
                    clickable ? "cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/40" : "cursor-default"
                  } ${isDayOff && clickable ? "hover:bg-teal-600 dark:hover:bg-teal-700" : ""}`}
                >
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm font-medium max-md:h-5 max-md:w-5 max-md:text-xs ${
                      isToday ? "bg-indigo-600 text-white" : ""
                    } ${
                      isDayOff
                        ? "text-white"
                        : isWeekend
                          ? "text-gray-300 dark:text-gray-600"
                          : "text-gray-700 dark:text-gray-200"
                    }`}
                  >
                    {day}
                  </span>
                  {isBankHol && (
                    <span className="mt-0.5 block truncate text-[10px] font-medium leading-tight text-amber-700 dark:text-amber-400">
                      {holTitles[dateStr]}
                    </span>
                  )}
                  {isDayOff && (
                    <span className="mt-0.5 block text-[10px] font-semibold leading-tight text-teal-50">
                      Day off
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-teal-500" />
            Day off (click a weekday to toggle)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-100 dark:bg-amber-900" />
            Bank holiday
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-gray-100 dark:bg-gray-800" />
            Weekend
          </span>
        </div>
      </div>
    </Card>
  );
}
