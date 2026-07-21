import { useState } from "react";
import NavBar, { type TabKey } from "./components/layout/NavBar";
import RequisitionBanner from "./components/layout/RequisitionBanner";
import { toMonthKey } from "./lib/format";
import DashboardTab from "./components/dashboard/DashboardTab";
import TransactionsTab from "./components/transactions/TransactionsTab";
import PlannerTab from "./components/planner/PlannerTab";
import RepaymentsTab from "./components/repayments/RepaymentsTab";
import SavingsTab from "./components/savings/SavingsTab";
import ProjectionsTab from "./components/projections/ProjectionsTab";
import RentTab from "./components/rent/RentTab";
import RemunerationTab from "./components/remuneration/RemunerationTab";
import HistoryTab from "./components/history/HistoryTab";
import NotesTab from "./components/notes/NotesTab";
import type { RentMatch } from "./types/rent";
import { Toaster } from "./lib/toast";
import { useAutoArchive } from "./hooks/useAutoArchive";
import { useHiddenTransactions } from "./hooks/useHiddenTransactions";

const MONTH_TABS: TabKey[] = ["dashboard", "transactions"];

const VALID_TABS: TabKey[] = [
  "dashboard", "transactions", "planner", "repayments", "savings",
  "projections", "rent", "remuneration", "history", "notes",
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
    setTransactionSearch(match.merchant_name || match.description || "");
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
      </main>
      <Toaster />
    </div>
  );
}
