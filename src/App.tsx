import { lazy, Suspense, useState, type ComponentType } from "react";
import NavBar, { type TabKey } from "./components/layout/NavBar";
import RequisitionBanner from "./components/layout/RequisitionBanner";
import { toMonthKey } from "./lib/format";
import DashboardTab from "./components/dashboard/DashboardTab";
import { Toaster } from "./lib/toast";
import { useAutoArchive } from "./hooks/useAutoArchive";
import { useHiddenTransactions } from "./hooks/useHiddenTransactions";
import type { RentMatch } from "./types/rent";

// Budget opens first, so it ships with the app; every other tab loads when opened.
// A page left open across a deploy asks for files that no longer exist, so a
// failed load reloads once to pick up the new version instead of breaking.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyTab<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const flag = "tab-reloaded";
  const storage = () => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  };
  return lazy(() =>
    load().then(
      (mod) => {
        storage()?.removeItem(flag);
        return mod;
      },
      (err) => {
        const s = storage();
        if (s && !s.getItem(flag)) {
          s.setItem(flag, "1");
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      },
    ),
  );
}

const TransactionsTab = lazyTab(() => import("./components/transactions/TransactionsTab"));
const PlannerTab = lazyTab(() => import("./components/planner/PlannerTab"));
const RepaymentsTab = lazyTab(() => import("./components/repayments/RepaymentsTab"));
const SavingsTab = lazyTab(() => import("./components/savings/SavingsTab"));
const ProjectionsTab = lazyTab(() => import("./components/projections/ProjectionsTab"));
const RentTab = lazyTab(() => import("./components/rent/RentTab"));
const RemunerationTab = lazyTab(() => import("./components/remuneration/RemunerationTab"));
const HistoryTab = lazyTab(() => import("./components/history/HistoryTab"));
const NotesTab = lazyTab(() => import("./components/notes/NotesTab"));
const TravelTab = lazyTab(() => import("./components/travel/TravelTab"));

const MONTH_TABS: TabKey[] = ["dashboard", "transactions"];

const VALID_TABS: TabKey[] = [
  "dashboard", "transactions", "planner", "repayments", "savings",
  "projections", "rent", "remuneration", "history", "notes", "travel",
];
const TAB_STORAGE_KEY = "active-tab";

// Restore the last-viewed tab so a hard refresh stays where you were.
const initialTab = (): TabKey => {
  const saved = localStorage.getItem(TAB_STORAGE_KEY) as TabKey | null;
  return saved && VALID_TABS.includes(saved) ? saved : "dashboard";
};

function AutoArchive() {
  useAutoArchive();
  return null;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [month, setMonth] = useState<string>(toMonthKey(new Date()));
  const [transactionSearch, setTransactionSearch] = useState("");
  // A new object per rent-link click so the tx table re-scrolls even on re-click.
  const [txFocus, setTxFocus] = useState<{ flagId: string } | null>(null);

  // Hidden transaction IDs, persisted to localStorage so they survive reloads.
  const { hiddenFor, hide, restore, restoreAll, pruneStale } = useHiddenTransactions();

  // Jump back to the top of the page whenever the tab changes.
  const changeTab = (t: TabKey) => {
    setTab(t);
    localStorage.setItem(TAB_STORAGE_KEY, t);
    window.scrollTo({ top: 0 });
  };

  const hidden = hiddenFor(month);
  const hideTransaction = (flagId: string) => hide(month, flagId);
  const restoreTransaction = (flagId: string) => restore(month, flagId);
  const restoreAllInMonth = () => restoreAll(month);
  const pruneStaleInMonth = (validIds: Set<string>) => pruneStale(month, validIds);
  const openRentMatch = (match: RentMatch) => {
    // The matched payment can live in a different month than the one currently
    // selected (bills are offset from the rent row they reconcile to), so jump
    // to the month the transaction actually posted in.
    const payMonth = (match.date ?? "").slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(payMonth)) setMonth(payMonth);
    if (match.flag_id) {
      // Precise: clear filters and highlight/scroll to the exact row.
      setTransactionSearch("");
      setTxFocus({ flagId: match.flag_id });
    } else {
      // Fallback for older data with no id: best-effort search.
      setTransactionSearch(match.merchant_name || match.description || "");
      setTxFocus(null);
    }
    setTab("transactions");
  };

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <AutoArchive />
      <NavBar
        active={tab}
        onChange={changeTab}
        selectedMonth={month}
        onMonthChange={setMonth}
        showMonth={MONTH_TABS.includes(tab)}
      />
      <RequisitionBanner />
      <main className="flex-1 overflow-x-auto p-3 md:p-5 max-md:!pb-[calc(5rem_+_env(safe-area-inset-bottom))]">
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-12">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            </div>
          }
        >
        {tab === "dashboard"    && <DashboardTab month={month} />}
        {tab === "transactions" && (
          <TransactionsTab
            month={month}
            hidden={hidden}
            onHide={hideTransaction}
            onRestoreRow={restoreTransaction}
            onRestoreAll={restoreAllInMonth}
            onPruneStale={pruneStaleInMonth}
            searchOverride={transactionSearch}
            focus={txFocus}
          />
        )}
        {tab === "planner"     && <PlannerTab />}
        {tab === "repayments"  && <RepaymentsTab />}
        {tab === "savings"     && <SavingsTab />}
        {tab === "projections" && <ProjectionsTab />}
        {tab === "rent"        && <RentTab onOpenTransactions={openRentMatch} />}
        {tab === "remuneration" && <RemunerationTab />}
        {tab === "history"     && <HistoryTab />}
        {tab === "notes"       && <NotesTab />}
        {tab === "travel"      && <TravelTab />}
        </Suspense>
      </main>
      <Toaster />
    </div>
  );
}
