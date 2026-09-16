import { useEffect, useMemo, useState } from "react";
import { useTransactions } from "../../hooks/useTransactions";
import { MAIN_CATEGORIES, RENT_UTILITY_CATEGORY } from "../../types/categories";
import type { Source, Transaction } from "../../types/transaction";
import { gbp, shortDate, formatMonthLabel } from "../../lib/format";
import { downloadCsv } from "../../lib/csv";
import { Card, QueryState } from "../common";
import TransactionTable, { SourceBadge } from "./TransactionTable";
import Select, { type SelectOption } from "../Select";

const SOURCES: Source[] = ["monzo", "amex", "chase", "hsbc"];

const CATEGORY_OPTIONS: SelectOption[] = [
  { value: "", label: "All categories" },
  ...MAIN_CATEGORIES.map((c) => ({ value: c, label: c })),
  { value: RENT_UTILITY_CATEGORY, label: RENT_UTILITY_CATEGORY },
  { value: "Uncategorized", label: "Uncategorized" },
];
const SOURCE_OPTIONS: SelectOption[] = [
  { value: "", label: "All sources" },
  ...SOURCES.map((s) => ({ value: s, label: s })),
];

interface Props {
  month: string;
  hidden: Set<string>;
  onHide: (flagId: string) => void;
  onRestoreRow: (flagId: string) => void;
  onRestoreAll: () => void;
  onPruneStale: (validIds: Set<string>) => void;
  searchOverride?: string;
  focus?: { flagId: string } | null;
}

export default function TransactionsTab({ month, hidden, onHide, onRestoreRow, onRestoreAll, onPruneStale, searchOverride, focus }: Props) {
  const txQuery = useTransactions(month);
  const [search, setSearch] = useState(searchOverride ?? "");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [showRestorePanel, setShowRestorePanel] = useState(false);

  useEffect(() => {
    if (searchOverride !== undefined && searchOverride !== search) {
      setSearch(searchOverride);
    }
  }, [searchOverride]);

  // When jumping to a specific transaction, drop any active filters so the row
  // it wants to highlight can't be filtered out of view.
  useEffect(() => {
    if (focus) {
      setSearch("");
      setCategory("");
      setSource("");
    }
  }, [focus]);

  const hiddenRows = useMemo<Transaction[]>(() => {
    const all = txQuery.data ?? [];
    return all.filter((t) => hidden.has(t.flag_id));
  }, [txQuery.data, hidden]);

  // Prune localStorage entries whose flag_ids no longer exist in the loaded data.
  // This handles cases where flag_ids were invalidated by backend changes.
  useEffect(() => {
    if (!txQuery.data) return;
    const validIds = new Set(txQuery.data.map((t) => t.flag_id));
    onPruneStale(validIds);
  }, [txQuery.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const all = (txQuery.data ?? []).filter((t) => !hidden.has(t.flag_id));
    const q = search.trim().toLowerCase();
    return all.filter((t) => {
      if (q) {
        const haystack = `${t.description} ${t.merchant_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (category && t.category !== category) return false;
      if (source && t.source !== source) return false;
      return true;
    });
  }, [txQuery.data, search, category, source, hidden]);

  // Net additions/refunds against spending (matches the budget tab's
  // spendByCategory), then report the positive spend total.
  const filteredSpend = useMemo(() => {
    const net = filtered.reduce((s, t) => s + t.amount, 0);
    return net < 0 ? -net : 0;
  }, [filtered]);
  const isFiltered = !!(search || category || source);

  // Anomaly detection: flag transactions ≥2x the per-category average for the month
  const anomalies = useMemo(() => {
    const all = txQuery.data ?? [];
    const catAmounts: Record<string, number[]> = {};
    for (const t of all) {
      if (t.amount >= 0 || t.one_time || t.category === "Uncategorized" || t.category === RENT_UTILITY_CATEGORY) continue;
      if (!catAmounts[t.category]) catAmounts[t.category] = [];
      catAmounts[t.category].push(-t.amount);
    }
    const flagged = new Set<string>();
    for (const t of all) {
      if (t.amount >= 0 || t.one_time || t.category === "Uncategorized" || t.category === RENT_UTILITY_CATEGORY) continue;
      const amounts = catAmounts[t.category];
      if (!amounts || amounts.length < 2) continue;
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      if (-t.amount >= avg * 2) flagged.add(t.flag_id);
    }
    return flagged;
  }, [txQuery.data]);

  function exportCsv() {
    const header = ["Date", "Description", "Amount (£)", "Source", "Category", "Subcategory", "Notes", "One-time"];
    const rows = filtered.map((t) => [
      shortDate(t.created),
      t.description,
      String(t.amount),
      t.source,
      t.category,
      t.subcategory,
      t.notes,
      t.one_time ? "Yes" : "No",
    ]);
    downloadCsv(`transactions-${month}.csv`, [header, ...rows]);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Transactions</h1>
          <p className="mt-0.5 text-sm text-gray-400">
            {formatMonthLabel(month)} · {filtered.length} transaction{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description…"
            className="w-full rounded-2xl bg-white py-2.5 pl-9 pr-3 text-sm ring-1 ring-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-900 dark:ring-gray-800"
          />
        </div>
        <div className="flex gap-2">
          <Select
            value={category}
            onChange={setCategory}
            options={CATEGORY_OPTIONS}
            className="flex-1 rounded-2xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800 sm:flex-none sm:min-w-[160px]"
          />
          <Select
            value={source}
            onChange={setSource}
            options={SOURCE_OPTIONS}
            capitalize
            className="flex-1 rounded-2xl border-0 bg-white px-3 py-2.5 text-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:ring-gray-800 sm:flex-none sm:min-w-[140px]"
          />
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex min-h-[2.75rem] items-center justify-between gap-2 rounded-2xl bg-gray-100/70 px-4 py-2 dark:bg-gray-800/50">
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {isFiltered ? "Filtered" : "Showing all"}
          </span>
          {hiddenRows.length > 0 && (
            <button
              onClick={() => setShowRestorePanel((v) => !v)}
              className="flex items-center gap-1 rounded-lg bg-[#c8b58f]/20 px-2.5 py-1 text-xs font-semibold text-[#7d6540] hover:bg-[#c8b58f]/30 dark:bg-[#c8b58f]/10 dark:text-[#d2bc92] dark:hover:bg-[#c8b58f]/20"
            >
              {hiddenRows.length} hidden — restore?
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isFiltered && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Filtered total</span>
              <span className="rounded-xl bg-gray-900 px-3 py-1 text-sm font-bold tabular-nums text-white shadow-sm dark:bg-white dark:text-gray-900">
                {gbp(filteredSpend)}
              </span>
            </div>
          )}
          <button
            onClick={exportCsv}
            className="hidden items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50 sm:flex dark:bg-gray-900 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-gray-800"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
              <path d="M8 1a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06L8.53 10.78a.75.75 0 0 1-1.06 0L4.22 7.53a.75.75 0 0 1 1.06-1.06L7.25 8.44V1.75A.75.75 0 0 1 8 1ZM1.5 13.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75Z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Restore panel */}
      {showRestorePanel && hiddenRows.length > 0 && (
        <Card className="p-0 overflow-hidden max-md:!p-0">
          <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">Hidden transactions</h2>
              <p className="mt-0.5 text-xs text-gray-400">
                {hiddenRows.length} left out of this view and its totals
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { onRestoreAll(); setShowRestorePanel(false); }}
                className="rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                Restore all
              </button>
              <button
                onClick={() => setShowRestorePanel(false)}
                aria-label="Close"
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>
          </div>
          {/* Same columns as the main table, so a hidden row reads like the row it was. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[760px] table-fixed text-sm">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-28" />
                <col className="w-24" />
                <col className="w-44" />
                <col className="w-32" />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Date", "Description", "Amount", "Source", "Category", ""].map((h, i) => (
                    <th
                      key={i}
                      className={`px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400 ${
                        h === "Amount" || h === "Category" ? "text-center" : "text-left"
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {hiddenRows.map((t) => (
                  <tr key={t.flag_id} className="text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/40">
                    <td className="whitespace-nowrap px-6 py-3">{shortDate(t.created)}</td>
                    <td className="truncate px-6 py-3 font-medium text-gray-700 dark:text-gray-300" title={t.description}>
                      {t.description}
                    </td>
                    <td className={`whitespace-nowrap px-6 py-3 text-center font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300"}`}>
                      {gbp(t.amount)}
                    </td>
                    <td className="px-6 py-3"><SourceBadge source={t.source} /></td>
                    <td className="truncate px-6 py-3 text-center">{t.subcategory || t.category || "Uncategorized"}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => onRestoreRow(t.flag_id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                          <path fillRule="evenodd" d="M3.5 8a4.5 4.5 0 0 1 7.68-3.18l.32.32H9.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 0 0-1.5 0v1.63l-.26-.26A6 6 0 1 0 14 8a.75.75 0 0 0-1.5 0A4.5 4.5 0 1 1 3.5 8Z" clipRule="evenodd" />
                        </svg>
                        Restore
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
            {hiddenRows.map((t) => (
              <li key={t.flag_id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{t.description}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
                    <span className="whitespace-nowrap">{shortDate(t.created)}</span>
                    <SourceBadge source={t.source} />
                    {t.category && <span className="truncate">{t.subcategory || t.category}</span>}
                  </p>
                </div>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-gray-200"}`}>
                  {gbp(t.amount)}
                </span>
                <button
                  onClick={() => onRestoreRow(t.flag_id)}
                  aria-label="Restore"
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
                    <path fillRule="evenodd" d="M3.5 8a4.5 4.5 0 0 1 7.68-3.18l.32.32H9.75a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 0 0-1.5 0v1.63l-.26-.26A6 6 0 1 0 14 8a.75.75 0 0 0-1.5 0A4.5 4.5 0 1 1 3.5 8Z" clipRule="evenodd" />
                  </svg>

                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-0 overflow-hidden max-md:!p-0">
        <QueryState isLoading={txQuery.isLoading} error={txQuery.error}>
          <TransactionTable transactions={filtered} month={month} onHide={onHide} anomalies={anomalies} focus={focus} />
        </QueryState>
      </Card>
    </div>
  );
}
