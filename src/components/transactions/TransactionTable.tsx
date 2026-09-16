import { useEffect, useRef, useState } from "react";
import type { Transaction } from "../../types/transaction";
import {
  useSetFlag,
  useSetCategory,
  useSetOneTime,
  useDeleteFlag,
} from "../../hooks/useTransactions";
import { gbp, shortDate } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import CategoryDropdown from "./CategoryDropdown";
import Tooltip from "../Tooltip";

// A calm dot per bank on a neutral chip — enough to tell them apart without
// the row lighting up in brand colours.
const SOURCE_COLORS: Record<string, string> = {
  monzo: "#6fa6a0",
  flex: "#a59bc4",
  amex: "#7f9cc0",
  chase: "#8b86b8",
  barclays: "#6f9fb8",
  hsbc: "#b3a089",
};

const SOURCE_LABELS: Record<string, string> = {
  monzo: "Monzo",
  flex: "Flex",
  amex: "AMEX",
  chase: "Chase",
  barclays: "Barclays",
  hsbc: "HSBC",
};

interface Props {
  transactions: Transaction[];
  month: string;
  onHide: (flagId: string) => void;
  anomalies?: Set<string>;
  /** When set (a fresh object each request), scroll to + highlight this row. */
  focus?: { flagId: string } | null;
}

export default function TransactionTable({ transactions, month, onHide, anomalies, focus }: Props) {
  const setFlag = useSetFlag(month);
  const setCategory = useSetCategory(month);
  const setOneTime = useSetOneTime(month);
  const clearOverride = useDeleteFlag(month);

  const changeCategory = (t: Transaction, subcategory: string) =>
    setCategory.mutate({
      flagId: t.flag_id,
      description: t.description,
      subcategory,
      // A one-time row is an exception, so its category is not remembered for
      // the merchant — the other rows spelled the same keep what they had.
      oneTime: t.one_time,
    });

  const toggleOneTime = (t: Transaction, oneTime: boolean) =>
    setOneTime.mutate({ flagId: t.flag_id, description: t.description, oneTime });

  const ONE_TIME_HINT =
    "One-time: any category set on this row applies to it alone, not to the merchant";

  /**
   * Drops the row's manual category so it follows the categoriser again.
   * Picking from the dropdown can only ever replace one override with another —
   * including "Uncategorized", which pins the row blank — so without this there
   * is no way back to the categoriser's own answer.
   */
  const resetCategory = (t: Transaction) => (
    <button
      onClick={() => clearOverride.mutate(t.flag_id)}
      title="Use the categoriser's own category for this row"
      aria-label="Reset category"
      className="shrink-0 rounded-lg px-1.5 py-1 text-sm leading-none text-gray-400 hover:bg-gray-100 hover:text-indigo-600 dark:hover:bg-gray-700 dark:hover:text-indigo-400"
    >
      ↺
    </button>
  );

  // Scroll to and briefly highlight a transaction requested from another tab
  // (e.g. a rent auto-paid link). Waits until the row is actually loaded, and
  // handles each focus request once so refetches don't re-trigger it.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const handledRef = useRef<Props["focus"]>(null);
  useEffect(() => {
    if (!focus || handledRef.current === focus) return;
    if (!transactions.some((t) => t.flag_id === focus.flagId)) return; // not loaded yet
    handledRef.current = focus;
    setHighlightId(focus.flagId);
    requestAnimationFrame(() => {
      document
        .querySelectorAll(`[data-flag-id="${CSS.escape(focus.flagId)}"]`)
        .forEach((el) => el.scrollIntoView({ behavior: "smooth", block: "center" }));
    });
    const timer = setTimeout(() => setHighlightId(null), 2600);
    return () => clearTimeout(timer);
  }, [focus, transactions]);

  const highlightClass = (t: Transaction) =>
    t.flag_id === highlightId
      ? "bg-indigo-50 ring-2 ring-inset ring-indigo-400 dark:bg-indigo-950/40"
      : "";

  const sourceBadge = (source: string) => (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source?.toLowerCase()] ?? "#9ca3af" }} />
      {SOURCE_LABELS[source] ?? source}
    </span>
  );

  // Rows arrive newest first; runs of the same day become one group with a total.
  const days: { key: string; label: string; net: number; rows: Transaction[] }[] = [];
  for (const t of transactions) {
    const key = (t.created ?? "").slice(0, 10);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      const [y, m, d] = key.split("-").map(Number);
      const label = key
        ? new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
        : "No date";
      day = { key, label, net: 0, rows: [] };
      days.push(day);
    }
    day.rows.push(t);
    day.net += t.amount;
  }
  const dayTotal = (net: number) =>
    net < 0 ? `${gbp(-net)} spent` : net > 0 ? `+${gbp(net)}` : "£0";

  // Phones keep each card short: the less-used controls open on demand.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const amount = (t: Transaction) => (
    <span className={`font-semibold ${t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-gray-200"}`}>
      {gbp(t.amount)}
    </span>
  );
  const anomalyFlag = (t: Transaction) =>
    anomalies?.has(t.flag_id) ? (
      <span title="Unusually large for this category" className="rounded px-1 py-0.5 text-[10px] font-semibold bg-[#c8b58f]/25 text-[#7d6540] dark:bg-[#c8b58f]/15 dark:text-[#d2bc92]">
        !
      </span>
    ) : null;

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] table-fixed text-sm">
          <colgroup>
            <col className="w-24" />
            <col />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-44" />
            <col className="w-40" />
            <col className="w-[88px]" />
            <col className="w-14" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Date</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Description</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Amount</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Source</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Notes</th>
              <th title={ONE_TIME_HINT} className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">One-time</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          {days.map((day) => (
          <tbody key={day.key} className="divide-y divide-gray-50 dark:divide-gray-800/60">
            <tr className="bg-gray-50/80 dark:bg-gray-800/30">
              <td colSpan={8} className="px-6 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{day.label}</span>
                  <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-400">{dayTotal(day.net)}</span>
                </div>
              </td>
            </tr>
            {day.rows.map((t) => (
              <tr key={t.id} data-flag-id={t.flag_id} className={`group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 ${highlightClass(t)}`}>
                <td className="whitespace-nowrap px-6 py-3 text-gray-500 dark:text-gray-400">{shortDate(t.created)}</td>
                <td className="px-6 py-3">
                  <Tooltip label={t.description} className="block">
                    <span className="block cursor-default truncate font-medium text-gray-800 dark:text-gray-200">{t.description}</span>
                  </Tooltip>
                </td>
                <td className="whitespace-nowrap px-6 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    {anomalyFlag(t)}
                    {amount(t)}
                  </div>
                </td>
                <td className="px-6 py-3">{sourceBadge(t.source)}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-1">
                    <div className="min-w-0 flex-1">
                      <CategoryDropdown value={t.subcategory} onChange={(subcategory) => changeCategory(t, subcategory)} />
                    </div>
                    {t.overridden && resetCategory(t)}
                  </div>
                </td>
                <td className="px-6 py-3">
                  <Tooltip label={t.notes} className="block">
                    <input
                      defaultValue={t.notes}
                      placeholder="Add note…"
                      onBlur={(e) => e.target.value !== t.notes && setFlag.mutate({ flagId: t.flag_id, update: { month, notes: e.target.value } })}
                      onKeyDown={commitOnEnter(t.notes)}
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-200 focus:outline-none dark:placeholder-gray-600 dark:focus:border-gray-700"
                    />
                  </Tooltip>
                </td>
                <td className="px-6 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={t.one_time}
                    title={ONE_TIME_HINT}
                    onChange={(e) => toggleOneTime(t, e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                  />
                </td>
                <td className="px-6 py-3">
                  <div className="flex items-center justify-end opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => onHide(t.flag_id)}
                      title="Hide from this view"
                      className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                    >
                      Hide
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          ))}
        </table>
      </div>

      {/* ── Mobile card list ──────────────────────────────────── */}
      <div className="md:hidden">
        {days.map((day) => (
          <section key={day.key}>
            <div className="flex items-center justify-between border-y border-gray-100 bg-gray-50/80 px-4 py-2 text-xs first:border-t-0 dark:border-gray-800 dark:bg-gray-800/30">
              <span className="font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{day.label}</span>
              <span className="font-semibold tabular-nums text-gray-500 dark:text-gray-400">{dayTotal(day.net)}</span>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {day.rows.map((t) => {
                const open = expanded.has(t.id);
                return (
                  <li key={t.id} data-flag-id={t.flag_id} className={`px-4 py-3 transition-colors ${highlightClass(t)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-800 dark:text-gray-200">{t.description}</p>
                        {t.notes && !open && <p className="mt-0.5 truncate text-xs text-gray-400">{t.notes}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {anomalyFlag(t)}
                        {amount(t)}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      {sourceBadge(t.source)}
                      <div className="min-w-0 flex-1">
                        <CategoryDropdown value={t.subcategory} onChange={(subcategory) => changeCategory(t, subcategory)} />
                      </div>
                      {t.overridden && resetCategory(t)}
                      <button
                        type="button"
                        onClick={() => toggleExpanded(t.id)}
                        aria-expanded={open}
                        aria-label={open ? "Fewer options" : "More options"}
                        className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition ${
                          open
                            ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                            : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                        }`}
                      >
                        {t.one_time && !open && (
                          <span title="One-time" className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-gray-900" />
                        )}
                        <svg viewBox="0 0 16 16" fill="currentColor" className="h-4 w-4">
                          <path d="M3 8a1.25 1.25 0 1 1-2.5 0A1.25 1.25 0 0 1 3 8Zm6.25 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm5 1.25a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z" />
                        </svg>
                      </button>
                    </div>

                    {open && (
                      <div className="mt-2.5 space-y-2.5 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-800/40">
                        <input
                          defaultValue={t.notes}
                          placeholder="Add note…"
                          onBlur={(e) => e.target.value !== t.notes && setFlag.mutate({ flagId: t.flag_id, update: { month, notes: e.target.value } })}
                          onKeyDown={commitOnEnter(t.notes)}
                          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm placeholder-gray-300 focus:border-indigo-300 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:placeholder-gray-600"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <label title={ONE_TIME_HINT} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={t.one_time}
                              onChange={(e) => toggleOneTime(t, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                            />
                            One-time (category for this row only)
                          </label>
                          <button
                            onClick={() => onHide(t.flag_id)}
                            className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-500 ring-1 ring-gray-200 hover:text-red-600 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-700 dark:hover:text-red-400"
                          >
                            Hide
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-400">{shortDate(t.created)}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
