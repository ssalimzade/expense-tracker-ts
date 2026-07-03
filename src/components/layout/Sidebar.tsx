export type TabKey =
  | "dashboard"
  | "transactions"
  | "repayments"
  | "savings"
  | "history";

const TABS: { key: TabKey; label: string; icon: JSX.Element }[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
        <path d="M2 10a8 8 0 1 1 16 0 8 8 0 0 1-16 0Zm8-5a1 1 0 0 1 1 1v4.586l2.707 2.707a1 1 0 0 1-1.414 1.414l-3-3A1 1 0 0 1 9 11V6a1 1 0 0 1 1-1Z" />
        <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 10a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 10Zm0 5.25a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "transactions",
    label: "Transactions",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
        <path fillRule="evenodd" d="M1 2.75A.75.75 0 0 1 1.75 2h16.5a.75.75 0 0 1 0 1.5H18v8.75A2.75 2.75 0 0 1 15.25 15h-1.072l.798 3.06a.75.75 0 0 1-1.452.38L13.41 18H6.59l-.114.44a.75.75 0 0 1-1.452-.38L5.823 15H4.75A2.75 2.75 0 0 1 2 12.25V3.5h-.25A.75.75 0 0 1 1 2.75ZM7.373 15l-.391 1.5h6.037l-.392-1.5H7.373Zm7.49-8.931a.75.75 0 0 1-.175 1.046 19.326 19.326 0 0 0-3.398 3.098.75.75 0 0 1-1.097.04L8.5 8.561l-2.22 2.22a.75.75 0 0 1-1.06-1.06l2.75-2.75a.75.75 0 0 1 1.06 0l1.664 1.663a20.82 20.82 0 0 1 3.122-2.74.75.75 0 0 1 1.047.175Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "repayments",
    label: "Repayments",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
        <path d="M2.5 4A1.5 1.5 0 0 0 1 5.5V6h18v-.5A1.5 1.5 0 0 0 17.5 4h-15ZM19 8.5H1v6A1.5 1.5 0 0 0 2.5 16h15a1.5 1.5 0 0 0 1.5-1.5v-6ZM3 13.25a.75.75 0 0 1 .75-.75h1.5a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm4.75-.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z" />
      </svg>
    ),
  },
  {
    key: "savings",
    label: "Savings",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
        <path d="M10.75 10.818v2.614A3.13 3.13 0 0 0 11.888 13c.482-.315.612-.648.612-.875 0-.227-.13-.56-.612-.875a3.13 3.13 0 0 0-1.138-.432ZM8.33 8.62c.053.055.115.11.184.164.208.16.46.284.736.363V6.603a2.45 2.45 0 0 0-.35.13c-.14.065-.27.143-.386.233-.335.257-.48.552-.481.787 0 .233.143.518.297.657Z" />
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a2.25 2.25 0 0 1 .28-.25V6.5a.75.75 0 0 1 1.5 0v.518l.145.065c.386.173.715.433.96.728.237.289.365.616.365.939 0 .325-.127.651-.364.94a2.76 2.76 0 0 1-.96.728l-.146.065v2.82c.406-.12.734-.334.96-.614.056-.07.109-.145.157-.225a.75.75 0 1 1 1.297.75 3.705 3.705 0 0 1-.356.516 4.075 4.075 0 0 1-1.058.816v.432a.75.75 0 0 1-1.5 0v-.518l-.145-.065a3.706 3.706 0 0 1-.96-.728 2.25 2.25 0 0 1-.365-.94c0-.325.127-.651.364-.94a2.76 2.76 0 0 1 .96-.728l.146-.065V7.488a2.44 2.44 0 0 0-.156.224.75.75 0 1 1-1.297-.75c.117-.203.252-.39.402-.541Z" clipRule="evenodd" />
      </svg>
    ),
  },
  {
    key: "history",
    label: "History",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0">
        <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
      </svg>
    ),
  },
];

interface Props {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export default function Sidebar({ active, onChange }: Props) {
  return (
    <nav
      className="flex shrink-0 border-gray-200/80 bg-white dark:border-gray-800 dark:bg-gray-900
                 md:w-52 md:flex-col md:border-r md:py-4
                 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:flex-row max-md:justify-around max-md:border-t max-md:px-2 max-md:py-2"
    >
      <div className="hidden px-4 pb-6 pt-2 md:block">
        <span className="text-base font-bold tracking-tight text-gray-900 dark:text-white">
          Expense Tracker
        </span>
      </div>

      <div className="flex flex-col gap-0.5 px-2 max-md:flex-row max-md:gap-0 max-md:px-0 max-md:w-full max-md:justify-around">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all
              max-md:flex-col max-md:gap-1 max-md:px-4 max-md:py-1.5 max-md:text-[10px]
              ${
                active === tab.key
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                  : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
