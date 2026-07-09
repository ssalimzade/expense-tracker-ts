import type { Transaction } from "../../types/transaction";
import { useSetFlag } from "../../hooks/useTransactions";
import { gbp, shortDate } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import CategoryDropdown from "./CategoryDropdown";
import Tooltip from "../Tooltip";

const SOURCE_COLORS: Record<string, string> = {
  monzo: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  flex: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  amex: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  chase: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  barclays: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

interface Props {
  transactions: Transaction[];
  month: string;
  onHide: (flagId: string) => void;
  anomalies?: Set<string>;
}

export default function TransactionTable({ transactions, month, onHide, anomalies }: Props) {
  const setFlag = useSetFlag(month);

  const sourceBadge = (source: string) => (
    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium capitalize ${SOURCE_COLORS[source?.toLowerCase()] ?? ""}`}>
      {source}
    </span>
  );
  const amount = (t: Transaction) => (
    <span className={`font-semibold ${t.amount >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-gray-200"}`}>
      {gbp(t.amount)}
    </span>
  );
  const anomalyFlag = (t: Transaction) =>
    anomalies?.has(t.flag_id) ? (
      <span title="Unusually large for this category" className="rounded px-1 py-0.5 text-[10px] font-semibold bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
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
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">One-time</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {transactions.map((t) => (
              <tr key={t.id} className="group transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40">
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
                  <CategoryDropdown value={t.subcategory} onChange={(subcategory) => setFlag.mutate({ flagId: t.flag_id, update: { month, subcategory } })} />
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
                    onChange={(e) => setFlag.mutate({ flagId: t.flag_id, update: { month, one_time: e.target.checked } })}
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
        </table>
      </div>

      {/* ── Mobile card list ──────────────────────────────────── */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {transactions.map((t) => (
          <li key={t.id} className="space-y-2.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800 dark:text-gray-200">{t.description}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                  <span className="whitespace-nowrap">{shortDate(t.created)}</span>
                  {sourceBadge(t.source)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {anomalyFlag(t)}
                {amount(t)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <CategoryDropdown value={t.subcategory} onChange={(subcategory) => setFlag.mutate({ flagId: t.flag_id, update: { month, subcategory } })} />
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <input
                  type="checkbox"
                  checked={t.one_time}
                  onChange={(e) => setFlag.mutate({ flagId: t.flag_id, update: { month, one_time: e.target.checked } })}
                  className="h-4 w-4 rounded border-gray-300 accent-indigo-600"
                />
                One-time
              </label>
              <button
                onClick={() => onHide(t.flag_id)}
                className="shrink-0 rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:bg-gray-700 dark:text-gray-400 dark:hover:bg-red-950 dark:hover:text-red-400"
              >
                Hide
              </button>
            </div>

            <input
              defaultValue={t.notes}
              placeholder="Add note…"
              onBlur={(e) => e.target.value !== t.notes && setFlag.mutate({ flagId: t.flag_id, update: { month, notes: e.target.value } })}
              onKeyDown={commitOnEnter(t.notes)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-2.5 py-1.5 text-sm placeholder-gray-300 focus:border-indigo-300 focus:outline-none dark:border-gray-700 dark:placeholder-gray-600"
            />
          </li>
        ))}
      </ul>
    </>
  );
}
