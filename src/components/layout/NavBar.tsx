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
  | "notes"
  | "travel";

// Tabs are split into groups, rendered left→right with a divider
// between each group on the desktop bar.
type TabGroup = "spending" | "planning" | "money" | "records";

const TABS: { key: TabKey; label: string; group: TabGroup }[] = [
  { key: "dashboard",    label: "Budget",       group: "spending" },
  { key: "transactions", label: "Transactions", group: "spending" },
  { key: "repayments",   label: "Repayments",   group: "spending" },
  { key: "planner",      label: "Planner",      group: "planning" },
  { key: "projections",  label: "Projections",  group: "planning" },
  { key: "rent",         label: "Rent",         group: "planning" },
  { key: "savings",      label: "Savings",      group: "money"    },
  { key: "remuneration", label: "Salary",       group: "money"    },
  { key: "travel",       label: "Travel",       group: "records"  },
  { key: "history",      label: "History",      group: "records"  },
  { key: "notes",        label: "Notes",        group: "records"  },
];

// Mobile-only icons (bottom bar). The tabs with a header icon reuse its shape —
// a wallet for Budget, a piggy bank for Savings — so the two bars agree.
const ICONS: Record<TabKey, ReactNode> = {
  dashboard: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M2.25 7.5A3.25 3.25 0 0 1 5.5 4.25h11.25A1.75 1.75 0 0 1 18.5 6v.75h1A2.25 2.25 0 0 1 21.75 9v8.25a2.5 2.5 0 0 1-2.5 2.5H5.5a3.25 3.25 0 0 1-3.25-3.25V7.5Zm14.75 6.75a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" clipRule="evenodd" />
    </svg>
  ),
  transactions: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M15.97 2.47a.75.75 0 0 1 1.06 0l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 1 1-1.06-1.06l3.22-3.22H7.5a.75.75 0 0 1 0-1.5h11.69l-3.22-3.22a.75.75 0 0 1 0-1.06Zm-7.94 9a.75.75 0 0 1 0 1.06l-3.22 3.22H16.5a.75.75 0 0 1 0 1.5H4.81l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
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
    <svg viewBox="0 0 200 200" fill="currentColor" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M52 76 A62 46 0 0 1 150 80 L150 60 L166 82 A62 46 0 0 1 162 112 H178 V130 H158 A62 46 0 0 1 136 150 V172 H118 V156 A70 46 0 0 1 82 156 V172 H64 V148 A62 46 0 0 1 52 76 Z M146 94 a7 7 0 1 0 0 14 7 7 0 0 0 0-14 Z"
        clipRule="evenodd"
      />
      <path d="M84 52 h32 v12 h-32 Z" />
    </svg>
  ),
  projections: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 0 1 .968-.431l5.942 2.28a.75.75 0 0 1 .431.97l-2.28 5.94a.75.75 0 1 1-1.4-.537l1.63-4.251-1.086.484a11.2 11.2 0 0 0-5.45 5.173.75.75 0 0 1-1.199.19L9 13.617l-5.97 5.97a.75.75 0 0 1-1.06-1.06l6.5-6.5a.75.75 0 0 1 1.06 0l2.27 2.27a12.7 12.7 0 0 1 5.21-4.677l1.086-.483-4.251-1.632a.75.75 0 0 1-.432-.967Z" clipRule="evenodd" />
    </svg>
  ),
  rent: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd" />
    </svg>
  ),
  remuneration: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
      <path d="M4 4.75h13A1.75 1.75 0 0 1 18.75 6.5v.75H6.5A2.25 2.25 0 0 0 4.25 9.5v6.25H4A1.75 1.75 0 0 1 2.25 14V6.5A1.75 1.75 0 0 1 4 4.75Z" />
      <path fillRule="evenodd" d="M6.5 8.75h13A2.25 2.25 0 0 1 21.75 11v6a2.25 2.25 0 0 1-2.25 2.25h-13A2.25 2.25 0 0 1 4.25 17v-6A2.25 2.25 0 0 1 6.5 8.75ZM13 16.25a2.25 2.25 0 1 0 0-4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" />
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
  travel: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
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
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-10 flex gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 py-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] dark:border-gray-800 dark:bg-gray-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            ref={active === tab.key ? activeRef : undefined}
            onClick={() => onChange(tab.key)}
            className={`flex shrink-0 min-w-[4.75rem] flex-col items-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-medium transition-all [&>svg]:h-6 [&>svg]:w-6 ${
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
