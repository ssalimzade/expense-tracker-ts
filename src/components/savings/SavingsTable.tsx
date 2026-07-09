import { useRef, useState } from "react";
import type { SavingsRow } from "../../types/savings";
import { useSaveSavingsRow } from "../../hooks/useSavings";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import { Card } from "../common";

/** Number input that shows comma-formatted integer on blur, raw on focus. */
function MoneyInput({
  value,
  onCommit,
  color,
  className = "",
}: {
  value: number;
  onCommit: (n: number) => void;
  color?: string;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState("");
  const touched = useRef(false);
  const fmt = `£${Math.round(value).toLocaleString("en-GB")}`;

  return (
    <input
      type="text"
      value={editing ? raw : fmt}
      style={color ? { color } : undefined}
      onFocus={() => { setEditing(true); touched.current = false; setRaw(value === 0 ? "" : String(Math.round(value))); }}
      onChange={(e) => { touched.current = true; setRaw(e.target.value); }}
      onBlur={() => {
        setEditing(false);
        if (!touched.current) return;
        const n = parseFloat(raw.replace(/[^0-9.-]/g, "")) || 0;
        onCommit(n);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") { setEditing(false); (e.target as HTMLInputElement).blur(); }
      }}
      className={`w-24 rounded-lg border border-transparent bg-transparent px-2 py-1 text-center text-sm focus:border-gray-200 focus:outline-none dark:focus:border-gray-700 ${color ? "font-semibold" : ""} ${className}`}
    />
  );
}

const LABELS: Record<string, string> = {
  starting_balance: "Starting",
  home_contributions: "Home",
  savings: "Savings",
  adjustments: "Adjustments",
  investments: "Investments",
};

// Match the Monthly Breakdown chart's colour scheme (modern, distinct hues).
const COLORS: Record<string, string> = {
  home_contributions: "#0ea5e9", // sky
  savings: "#10b981",            // emerald
  adjustments: "#f59e0b",        // amber
  investments: "#a855f7",        // purple
};

// Ending balance — the running total — gets its own distinct colour.
const ENDING_COLOR = "#14b8a6"; // teal

const mo = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { month: "long" });
};

// "YYYY-MM" key for comparing months.
const monthKey = (iso: string) => iso.slice(0, 7);
const currentKey = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

interface Props {
  rows: SavingsRow[];
  showInvestments: boolean;
  /** start_date of the earliest savings row — the only one with an editable
   *  starting balance (the seed). Every other month derives it from the
   *  previous month's ending balance. */
  seedDate: string;
}

export default function SavingsTable({ rows, showInvestments, seedDate }: Props) {
  const save = useSaveSavingsRow();

  const editableFields: (keyof SavingsRow)[] = [
    "starting_balance",
    "home_contributions",
    "savings",
    "adjustments",
    ...(showInvestments ? (["investments"] as (keyof SavingsRow)[]): []),
  ];

  const commitNumber = (row: SavingsRow, field: keyof SavingsRow, value: number) => {
    if (value === row[field]) return;
    save.mutate({ ...row, [field]: value } as SavingsRow);
  };

  const commitNotes = (row: SavingsRow, notes: string) => {
    if (notes === row.adjustment_notes) return;
    save.mutate({ ...row, adjustment_notes: notes });
  };

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Monthly Savings
        </h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[700px] text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Month</th>
              {editableFields.map((f) => (
                <th
                  key={f}
                  className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider"
                  style={{ color: COLORS[f as string] ?? undefined }}
                >
                  <span className={COLORS[f as string] ? "" : "text-gray-600 dark:text-white"}>
                    {LABELS[f] ?? f}
                  </span>
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: ENDING_COLOR }}>Ending</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {rows.map((row) => {
              const isFuture = monthKey(row.start_date) > currentKey;
              return (
                <tr
                  key={row.start_date}
                  className={`group hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isFuture ? "opacity-40" : ""}`}
                >
                  <td className="px-6 py-3 font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {mo(row.start_date)}
                  </td>
                  {editableFields.map((field) => {
                    // Starting balance is derived (= previous month's ending)
                    // for every month except the earliest seed row.
                    const startingDerived =
                      field === "starting_balance" && row.start_date !== seedDate;
                    return (
                      <td key={field} className="px-6 py-3 text-center">
                        {startingDerived ? (
                          <span
                            className="inline-block w-24 px-2 py-1 text-center text-sm text-gray-400 dark:text-gray-500"
                            title="Derived from the previous month's ending balance"
                          >
                            {gbp0((row[field] as number) ?? 0)}
                          </span>
                        ) : (
                          <MoneyInput
                            value={(row[field] as number) ?? 0}
                            onCommit={(n) => commitNumber(row, field, n)}
                            color={COLORS[field as string]}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-3 text-center font-bold whitespace-nowrap" style={{ color: ENDING_COLOR }}>
                    {gbp0(row.ending_balance)}
                  </td>
                  <td className="px-6 py-3">
                    <input
                      defaultValue={row.adjustment_notes}
                      placeholder="Notes…"
                      onBlur={(e) => commitNotes(row, e.target.value)}
                      onKeyDown={commitOnEnter(row.adjustment_notes)}
                      className="w-full min-w-[140px] rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-200 focus:outline-none dark:placeholder-gray-600 dark:focus:border-gray-700"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {rows.map((row) => {
          const isFuture = monthKey(row.start_date) > currentKey;
          const startingDerived = row.start_date !== seedDate;
          // Editable category field for the mobile card (label + right-aligned input).
          const renderField = (field: keyof SavingsRow) => (
            <div key={field} className="flex items-center justify-between gap-1">
              <span className="shrink-0 text-gray-400">{LABELS[field as string] ?? field}</span>
              <MoneyInput
                value={(row[field] as number) ?? 0}
                onCommit={(n) => commitNumber(row, field, n)}
                color={COLORS[field as string]}
                className="!w-16 !px-1 !text-right"
              />
            </div>
          );
          return (
            <li key={row.start_date} className={`px-4 py-3 ${isFuture ? "opacity-40" : ""}`}>
              {/* Month on the left, starting balance value on the right (same line). */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-gray-700 dark:text-gray-300">{mo(row.start_date)}</span>
                <div className="flex items-center gap-1.5 text-xs">
                  {startingDerived ? (
                    <span
                      className="inline-block w-20 px-1 py-0.5 text-right tabular-nums text-gray-400"
                      title="Derived from the previous month's ending balance"
                    >
                      {gbp0(row.starting_balance ?? 0)}
                    </span>
                  ) : (
                    <MoneyInput
                      value={row.starting_balance ?? 0}
                      onCommit={(n) => commitNumber(row, "starting_balance", n)}
                      className="!w-20 !px-1 !text-right"
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="space-y-1">
                  {renderField("savings")}
                  {renderField("home_contributions")}
                </div>
                <div className="space-y-1">
                  {showInvestments && renderField("investments")}
                  {renderField("adjustments")}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Ending</span>
                <span className="text-base font-bold" style={{ color: ENDING_COLOR }}>{gbp0(row.ending_balance)}</span>
              </div>
              <input
                defaultValue={row.adjustment_notes}
                placeholder="Notes…"
                onBlur={(e) => commitNotes(row, e.target.value)}
                onKeyDown={commitOnEnter(row.adjustment_notes)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-300 focus:outline-none dark:border-gray-700 dark:placeholder-gray-600"
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
