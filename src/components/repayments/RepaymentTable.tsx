import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import type { Repayment, RepaymentUpdate } from "../../types/repayment";
import {
  useSaveRepayment,
  useRepaymentCategories,
  useAddRepaymentCategory,
} from "../../hooks/useRepayments";
import { gbp, shortDate } from "../../lib/format";
import { leftToPay } from "../../lib/repayments";
import { commitOnEnter } from "../../lib/keys";
import { MAIN_CATEGORIES } from "../../types/categories";
import { Card } from "../common";
import CurrencyInput from "../CurrencyInput";
import Select, { type SelectOption } from "../Select";
import Tooltip from "../Tooltip";

// Sentinel option value that opens a prompt to create a new category.
const ADD_NEW = "__add_category__";

type SplitNum = 1 | 2 | 3;

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface Props {
  repayments: Repayment[];
  onDelete: (r: Repayment) => void;
}

export default function RepaymentTable({ repayments, onDelete }: Props) {
  const save = useSaveRepayment();
  const { data: extraCategories = [] } = useRepaymentCategories();
  const addCategory = useAddRepaymentCategory();

  // Budget categories + persisted extras (e.g. Savings) + a "new" action.
  const categoryOptions: SelectOption[] = useMemo(() => {
    const base = MAIN_CATEGORIES as readonly string[];
    const extras = extraCategories.filter((c) => !base.includes(c));
    return [
      { value: "", label: "—" },
      ...base.map((c) => ({ value: c, label: c })),
      ...extras.map((c) => ({ value: c, label: c })),
      { value: ADD_NEW, label: "＋ New category…" },
    ];
  }, [extraCategories]);

  // Row id currently showing the inline "new category" input (if any).
  const [addingFor, setAddingFor] = useState<string | null>(null);

  const onCategoryChange = (r: Repayment, value: string) => {
    if (value === ADD_NEW) {
      setAddingFor(r.id);
      return;
    }
    save.mutate({ flex_id: r.flex_id, category: value });
  };

  const commitNewCategory = (r: Repayment, name: string) => {
    const trimmed = name.trim();
    setAddingFor(null);
    if (!trimmed) return;
    // Persist the category, then assign it to this row once saved.
    addCategory.mutate(trimmed, {
      onSuccess: () => save.mutate({ flex_id: r.flex_id, category: trimmed }),
    });
  };

  const [search, setSearch] = useState("");

  // Ephemeral "ticked" rows — a visual scratchpad only. Not persisted, so it
  // resets on refresh or when switching tabs.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const toggleTick = (id: string) =>
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saveDate = (r: Repayment, n: SplitNum, value: string) => {
    const patch: RepaymentUpdate = { flex_id: r.flex_id };
    if (n === 1) patch.repayment_1_date = value || null;
    else if (n === 2) patch.repayment_2_date = value || null;
    else patch.repayment_3_date = value || null;
    save.mutate(patch);
  };

  const saveAmount = (r: Repayment, n: SplitNum, rawValue: string) => {
    const parsed = rawValue ? parseFloat(rawValue) : null;
    const amount = parsed !== null ? -Math.abs(parsed) : null;
    const patch: RepaymentUpdate = { flex_id: r.flex_id };
    if (n === 1) patch.repayment_1_amount = amount;
    else if (n === 2) patch.repayment_2_amount = amount;
    else patch.repayment_3_amount = amount;
    save.mutate(patch);
  };

  const dateOf = (r: Repayment, n: SplitNum) =>
    n === 1 ? r.repayment_1_date : n === 2 ? r.repayment_2_date : r.repayment_3_date;
  const amountOf = (r: Repayment, n: SplitNum) =>
    n === 1 ? r.repayment_1_amount : n === 2 ? r.repayment_2_amount : r.repayment_3_amount;

  const today = new Date().toISOString().slice(0, 10);

  // Filter by description or amount (digits only for the amount match).
  const q = search.trim().toLowerCase();
  const amtQ = q.replace(/[£,\s]/g, "");
  const filtered = q
    ? repayments.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          (amtQ !== "" && String(Math.abs(r.amount)).includes(amtQ)),
      )
    : repayments;

  if (repayments.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-400">No active repayments in this period</p>
      </Card>
    );
  }

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:py-4 2xl:px-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Repayment Schedule
        </h2>
        <div className="relative mt-3 w-full max-w-xs">
          <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400">
            <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description or amount…"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-sm dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[1280px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="w-10 px-3 py-3" />
              <th className="w-20 px-3 2xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Date</th>
              <th className="min-w-[150px] px-3 2xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Description</th>
              <th className="w-24 px-3 2xl:px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Amount</th>
              <th className="w-24 px-3 2xl:px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">Left to Pay</th>
              <th className="w-40 px-3 2xl:px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Category</th>
              <th className="min-w-[160px] px-3 2xl:px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Notes</th>
              {([1, 2, 3] as const).map((n) => (
                <th key={n} className="w-32 px-3 2xl:px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                  Repayment {n}
                </th>
              ))}
              <th className="w-16 px-3 2xl:px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Refund</th>
              <th className="w-20 px-3 2xl:px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {filtered.map((r) => {
              const isTicked = ticked.has(r.id);
              return (
              <tr
                key={r.id}
                className={`group ${
                  isTicked
                    ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60"
                    : r.refunded
                    ? "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                }`}
              >
                <td className="px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleTick(r.id)}
                    title={isTicked ? "Untick" : "Tick"}
                    className={`flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
                      isTicked
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
                    }`}
                  >
                    <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                      <path d="M2.5 6.2 4.7 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 2xl:px-6 py-3 text-gray-500 dark:text-gray-400">
                  {shortDate(r.created)}
                </td>
                <td className="max-w-[150px] px-3 2xl:px-6 py-3">
                  <Tooltip label={r.description} className="block">
                    <span className="block cursor-default truncate font-medium text-gray-800 dark:text-gray-200">
                      {r.description}
                    </span>
                  </Tooltip>
                </td>
                <td className="px-3 2xl:px-6 py-3 text-center font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">
                  {gbp(Math.abs(r.amount))}
                </td>
                <td className="px-3 2xl:px-6 py-3 text-center font-semibold whitespace-nowrap text-indigo-600 dark:text-indigo-400">
                  {gbp(leftToPay(r))}
                </td>
                <td className="px-3 2xl:px-6 py-3">
                  {addingFor === r.id ? (
                    <input
                      autoFocus
                      placeholder="New category…"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitNewCategory(r, e.currentTarget.value);
                        else if (e.key === "Escape") setAddingFor(null);
                      }}
                      onBlur={(e) => commitNewCategory(r, e.currentTarget.value)}
                      className="w-full rounded-lg border border-indigo-400 bg-transparent px-2 py-1 text-sm focus:outline-none dark:border-indigo-600"
                    />
                  ) : (
                    <Select
                      value={r.category || ""}
                      onChange={(value) => onCategoryChange(r, value)}
                      options={categoryOptions}
                      className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
                    />
                  )}
                </td>
                <td className="px-3 2xl:px-6 py-3">
                  <Tooltip label={r.notes} className="block">
                    <input
                      defaultValue={r.notes}
                      placeholder="Add note…"
                      onBlur={(e) =>
                        e.target.value !== r.notes &&
                        save.mutate({ flex_id: r.flex_id, notes: e.target.value })
                      }
                      onKeyDown={commitOnEnter(r.notes)}
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-200 focus:outline-none dark:placeholder-gray-600 dark:focus:border-gray-700"
                    />
                  </Tooltip>
                </td>
                {([1, 2, 3] as const).map((n) => {
                  const date = dateOf(r, n);
                  const amount = amountOf(r, n);
                  const isPast = date && date.slice(0, 10) < today;
                  return (
                    <td key={n} className="px-2 2xl:px-4 py-3">
                      <div className={`flex flex-col items-center gap-1.5 ${isPast ? "opacity-50" : ""}`}>
                        <DatePicker
                          selected={date ? parseLocal(date.slice(0, 10)) : null}
                          onChange={(d: Date | null) => saveDate(r, n, d ? toISO(d) : "")}
                          dateFormat="d MMM yy"
                          placeholderText="—"
                          popperProps={{ strategy: "fixed" }}
                          wrapperClassName="w-24"
                          className={`w-24 rounded-lg border border-gray-200 bg-transparent px-1.5 py-1.5 text-center text-xs dark:border-gray-700 cursor-pointer ${isPast ? "line-through" : ""}`}
                        />
                        <CurrencyInput
                          value={amount ?? null}
                          allowEmpty
                          forceNegative
                          onCommit={(v) => saveAmount(r, n, v === null ? "" : String(v))}
                          className="w-24 rounded-lg border border-gray-200 bg-transparent px-1.5 py-1.5 text-center text-xs dark:border-gray-700"
                        />
                      </div>
                    </td>
                  );
                })}
                <td className="px-3 2xl:px-6 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={r.refunded}
                    onChange={(e) => save.mutate({ flex_id: r.flex_id, refunded: e.target.checked })}
                    title="Mark as refunded"
                    className="h-4 w-4 rounded border-gray-300 accent-rose-600"
                  />
                </td>
                <td className="px-3 2xl:px-6 py-3">
                  <button
                    onClick={() => onDelete(r)}
                    className="whitespace-nowrap rounded-lg px-2 py-1 text-xs font-medium text-red-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="px-6 py-6 text-center text-sm text-gray-400">
                  No repayments match “{search}”
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {filtered.map((r) => (
          <li key={r.id} className={`space-y-2 px-4 py-3 ${r.refunded ? "bg-rose-50/60 dark:bg-rose-950/30" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-800 dark:text-gray-200">{r.description}</p>
                <p className="text-xs text-gray-400">{shortDate(r.created)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{gbp(Math.abs(r.amount))}</p>
                <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{gbp(leftToPay(r))} left</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                {addingFor === r.id ? (
                  <input
                    autoFocus
                    placeholder="New category…"
                    onKeyDown={(e) => { if (e.key === "Enter") commitNewCategory(r, e.currentTarget.value); else if (e.key === "Escape") setAddingFor(null); }}
                    onBlur={(e) => commitNewCategory(r, e.currentTarget.value)}
                    className="w-full rounded-lg border border-indigo-400 bg-transparent px-2 py-1 text-sm focus:outline-none dark:border-indigo-600"
                  />
                ) : (
                  <Select value={r.category || ""} onChange={(value) => onCategoryChange(r, value)} options={categoryOptions} className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-700" />
                )}
              </div>
              <label className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                <input type="checkbox" checked={r.refunded} onChange={(e) => save.mutate({ flex_id: r.flex_id, refunded: e.target.checked })} className="h-4 w-4 rounded border-gray-300 accent-rose-600" />
                Refund
              </label>
            </div>
            <input
              defaultValue={r.notes}
              placeholder="Add note…"
              onBlur={(e) => e.target.value !== r.notes && save.mutate({ flex_id: r.flex_id, notes: e.target.value })}
              onKeyDown={commitOnEnter(r.notes)}
              className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-300 focus:outline-none dark:border-gray-700 dark:placeholder-gray-600"
            />
            <div className="grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((n) => {
                const date = dateOf(r, n);
                const amount = amountOf(r, n);
                const isPast = date && date.slice(0, 10) < today;
                return (
                  <div key={n} className={`space-y-1 ${isPast ? "opacity-50" : ""}`}>
                    <DatePicker
                      selected={date ? parseLocal(date.slice(0, 10)) : null}
                      onChange={(d: Date | null) => saveDate(r, n, d ? toISO(d) : "")}
                      dateFormat="d MMM"
                      placeholderText="—"
                      popperProps={{ strategy: "fixed" }}
                      wrapperClassName="w-full"
                      className={`w-full rounded-lg border border-gray-200 bg-transparent px-1 py-1 text-center text-xs dark:border-gray-700 ${isPast ? "line-through" : ""}`}
                    />
                    <CurrencyInput
                      value={amount ?? null}
                      allowEmpty
                      forceNegative
                      onCommit={(v) => saveAmount(r, n, v === null ? "" : String(v))}
                      className="w-full rounded-lg border border-gray-200 bg-transparent px-1 py-1 text-center text-xs dark:border-gray-700"
                    />
                  </div>
                );
              })}
            </div>
            <button onClick={() => onDelete(r)} className="text-xs font-medium text-red-400 hover:text-red-600">Delete</button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-400">No repayments match “{search}”</li>
        )}
      </ul>
    </Card>
  );
}
