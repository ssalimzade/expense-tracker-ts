import { Fragment, useEffect, useRef, type ReactNode } from "react";
import { recentMonths } from "../../lib/format";
import Select from "../Select";

export type TabKey =
  | "dashboard"
  | "transactions"
  | "planner"
  | "repayments"
  | "savings"
  | "projections"
  | "rent"
  | "remuneration"
  | "history"
  | "notes";

// Tabs are split into groups, rendered left→right with a divider
// between each group on the desktop bar.
type TabGroup = "spending" | "monthly" | "planning" | "records" | "notes";

const TABS: { key: TabKey; label: string; group: TabGroup }[] = [
  { key: "dashboard",    label: "Budget",       group: "spending" },
  { key: "transactions", label: "Transactions", group: "spending" },
  { key: "planner",      label: "Planner",      group: "monthly"  },
  { key: "repayments",   label: "Repayments",   group: "monthly"  },
  { key: "projections",  label: "Projections",  group: "planning" },
  { key: "rent",         label: "Rent",         group: "planning" },
  { key: "savings",      label: "Savings",      group: "planning" },
  { key: "remuneration", label: "Salary",       group: "records"  },
  { key: "history",      label: "History",      group: "records"  },
  { key: "notes",        label: "Notes",        group: "notes"    },
];

// Mobile-only icons (bottom bar)
const ICONS: Record<TabKey, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Z M10 5a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 11V6a1 1 0 0 1 1-1Z" />
      <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  ),
  transactions: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h16.5a.75.75 0 0 1 0 1.5H18v8.75A2.75 2.75 0 0 1 15.25 15h-1.072l.798 3.06a.75.75 0 0 1-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 0 1-1.452-.38L5.823 15H4.75A2.75 2.75 0 0 1 2 12.25V3.5h-.25A.75.75 0 0 1 1 2.75Z" clipRule="evenodd" />
    </svg>
  ),
  planner: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5a1.25 1.25 0 0 0-1.25 1.25v7c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-7A1.25 1.25 0 0 0 15.25 7H4.75Zm2 2.5a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Zm4.25.75a.75.75 0 0 1 .75-.75h.5a.75.75 0 0 1 0 1.5h-.5a.75.75 0 0 1-.75-.75ZM6.75 13a.75.75 0 0 0 0 1.5h.5a.75.75 0 0 0 0-1.5h-.5Z" clipRule="evenodd" />
    </svg>
  ),
  repayments: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
  savings: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.335.257-.48.552-.481.787 0 .233.143.518.297.657Z" />
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a2.25 2.25 0 0 1 .28-.25V6.5a.75.75 0 0 1 1.5 0v.518l.145.065c.386.173.715.433.96.728.237.289.365.616.365.939 0 .325-.127.651-.364.94a2.76 2.76 0 0 1-.96.728l-.146.065v2.82c.406-.12.734-.334.96-.614a.75.75 0 1 1 1.297.75 4.075 4.075 0 0 1-1.058.816v.432a.75.75 0 0 1-1.5 0v-.518l-.145-.065a3.706 3.706 0 0 1-.96-.728 2.25 2.25 0 0 1-.365-.94c0-.325.127-.651.364-.94a2.76 2.76 0 0 1 .96-.728l.146-.065V7.488a2.44 2.44 0 0 0-.156.224.75.75 0 1 1-1.297-.75c.117-.203.252-.39.402-.541Z" clipRule="evenodd" />
    </svg>
  ),
  projections: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 0 1 .968-.431l5.942 2.28a.75.75 0 0 1 .431.97l-2.28 5.94a.75.75 0 1 1-1.4-.537l1.63-4.251-1.086.484a11.2 11.2 0 0 0-5.45 5.173.75.75 0 0 1-1.199.19L9 13.617l-5.97 5.97a.75.75 0 0 1-1.06-1.06l6.5-6.5a.75.75 0 0 1 1.06 0l2.27 2.27a12.7 12.7 0 0 1 5.21-4.677l1.086-.483-4.251-1.632a.75.75 0 0 1-.432-.967Z" clipRule="evenodd" />
    </svg>
  ),
  rent: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  ),
  remuneration: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M1 4.25C1 3.56 1.56 3 2.25 3h15.5c.69 0 1.25.56 1.25 1.25v8.5c0 .69-.56 1.25-1.25 1.25H2.25C1.56 14 1 13.44 1 12.75v-8.5ZM10 6a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM4.75 6a.75.75 0 0 0 0 1.5.75.75 0 0 1 .75.75.75.75 0 0 0 1.5 0A2.25 2.25 0 0 0 4.75 6Zm10.5 0A2.25 2.25 0 0 0 13 8.25a.75.75 0 0 0 1.5 0 .75.75 0 0 1 .75-.75.75.75 0 0 0 0-1.5ZM3 16.25a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z" />
    </svg>
  ),
  history: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
    </svg>
  ),
  notes: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M3 4a2 2 0 0 1 2-2h7.586a1 1 0 0 1 .707.293l3.414 3.414a1 1 0 0 1 .293.707V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Zm4 3.75A.75.75 0 0 1 7.75 7h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 7 7.75Zm0 3.5a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Zm0 3.5a.75.75 0 0 1 .75-.75h2.5a.75.75 0 0 1 0 1.5h-2.5a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
    </svg>
  ),
};

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  selectedMonth: string;
  onMonthChange: (m: string) => void;
  showMonth: boolean;
}

export default function NavBar({ active, onChange, selectedMonth, onMonthChange, showMonth }: Props) {
  const months = recentMonths();
  // Keep the active tab visible in the scrollable mobile bar.
  const activeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [active]);
  return (
    <>
      {/* ── Desktop top bar ─────────────────────────────────── */}
      <header className="hidden md:flex h-14 shrink-0 items-center border-b border-gray-200/80 bg-white px-5 dark:border-gray-800 dark:bg-gray-900">
        {/* Brand */}
        <div className="flex items-center gap-2 pr-6 mr-2 border-r border-gray-200 dark:border-gray-700">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white text-sm font-bold">
            £
          </div>
          <span className="text-sm font-bold tracking-tight">Expense Tracker</span>
        </div>

        {/* Tabs */}
        <nav className="flex flex-1 items-center gap-0.5">
          {TABS.map((tab, i) => (
            <Fragment key={tab.key}>
              {i > 0 && TABS[i - 1].group !== tab.group && (
                <span className="mx-1.5 h-5 w-px bg-gray-200 dark:bg-gray-700" aria-hidden />
              )}
              <button
                onClick={() => onChange(tab.key)}
                className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-all ${
                  active === tab.key
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
              </button>
            </Fragment>
          ))}
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-2">
          {showMonth && (
            <Select
              value={selectedMonth}
              onChange={onMonthChange}
              options={months.map((m) => ({ value: m, label: m }))}
              className="min-w-[120px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            />
          )}
        </div>
      </header>

      {/* ── Mobile top strip (brand + month picker) ──────────── */}
      <header className="flex md:hidden h-12 shrink-0 items-center justify-between border-b border-gray-200/80 bg-white px-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
            £
          </div>
          <span className="text-sm font-bold tracking-tight">Expense Tracker</span>
        </div>
        {showMonth && (
          <Select
            value={selectedMonth}
            onChange={onMonthChange}
            options={months.map((m) => ({ value: m, label: m }))}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          />
        )}
      </header>

      {/* ── Mobile bottom bar (horizontally scrollable) ──────── */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-10 flex gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-gray-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            ref={active === tab.key ? activeRef : undefined}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 min-w-[4.25rem] flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-all ${
              active === tab.key
                ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
                : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {ICONS[tab.key]}
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
