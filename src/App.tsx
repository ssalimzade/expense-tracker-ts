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
import { Toaster } from "./lib/toast";
import { useAutoArchive } from "./hooks/useAutoArchive";
import { useHiddenTransactions } from "./hooks/useHiddenTransactions";

const MONTH_TABS: TabKey[] = ["dashboard", "transactions"];

function AutoArchive() {
  useAutoArchive();
  return null;
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [month, setMonth] = useState<string>(toMonthKey(new Date()));

  // Hidden transaction IDs, persisted to localStorage so they survive reloads.
  const { hiddenFor, hide, restore, restoreAll, pruneStale } = useHiddenTransactions();

  const hidden = hiddenFor(month);
  const hideTransaction = (flagId: string) => hide(month, flagId);
  const restoreTransaction = (flagId: string) => restore(month, flagId);
  const restoreAllInMonth = () => restoreAll(month);
  const pruneStaleInMonth = (validIds: Set<string>) => pruneStale(month, validIds);

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <AutoArchive />
      <NavBar
        active={tab}
        onChange={setTab}
        selectedMonth={month}
        onMonthChange={setMonth}
        showMonth={MONTH_TABS.includes(tab)}
      />
      <RequisitionBanner />
      <main className="flex-1 overflow-x-auto p-5 pb-20 md:pb-5">
        {tab === "dashboard"    && <DashboardTab month={month} />}
        {tab === "transactions" && (
          <TransactionsTab
            month={month}
            hidden={hidden}
            onHide={hideTransaction}
            onRestoreRow={restoreTransaction}
            onRestoreAll={restoreAllInMonth}
            onPruneStale={pruneStaleInMonth}
          />
        )}
        {tab === "planner"     && <PlannerTab />}
        {tab === "repayments"  && <RepaymentsTab />}
        {tab === "savings"     && <SavingsTab />}
        {tab === "projections" && <ProjectionsTab />}
        {tab === "rent"        && <RentTab />}
        {tab === "remuneration" && <RemunerationTab />}
        {tab === "history"     && <HistoryTab />}
        {tab === "notes"       && <NotesTab />}
      </main>
      <Toaster />
    </div>
  );
}
