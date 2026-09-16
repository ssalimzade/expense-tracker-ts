import { useRef, useState } from "react";
import { CHART } from "../../lib/chart";
import type { SavingsRow } from "../../types/savings";
import { useSaveSavingsRow } from "../../hooks/useSavings";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";

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

// Match the Monthly Breakdown chart's colours.
const COLORS: Record<string, string> = {
  home_contributions: CHART.dusk,
  savings: CHART.moss,
  adjustments: CHART.sand,
  investments: CHART.lavender,
};


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

  const monthNow = rows.find((r) => monthKey(r.start_date) === currentKey)?.start_date;
  // Scale for the little "what went in" bars: the biggest month's total inflow.
  const inflow = (r: SavingsRow) =>
    Math.max(0, r.home_contributions) + Math.max(0, r.savings) + Math.max(0, r.adjustments) + (showInvestments ? Math.max(0, r.investments ?? 0) : 0);
  const maxInflow = Math.max(1, ...rows.map(inflow));
  const barFields = editableFields.filter((f) => f !== "starting_balance");

  const composition = (row: SavingsRow) => (
    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      {barFields.map((f) => {
        const v = Math.max(0, (row[f] as number) ?? 0);
        return v > 0 ? (
          <span key={f} className="h-full" style={{ width: `${(v / maxInflow) * 100}%`, backgroundColor: COLORS[f as string] }} />
        ) : null;
      })}
    </div>
  );

  const change = (row: SavingsRow) => {
    const d = row.ending_balance - (row.starting_balance ?? 0);
    return (
      <span className={`text-xs font-semibold tabular-nums ${d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>
        {d >= 0 ? "+" : "−"}
        {gbp0(Math.abs(d))}
      </span>
    );
  };

  const desktopCols = showInvestments
    ? "md:grid-cols-[8rem_repeat(5,minmax(0,6rem))_7rem_minmax(8rem,1fr)]"
    : "md:grid-cols-[8rem_repeat(4,minmax(0,6rem))_7rem_minmax(8rem,1fr)]";

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Month by month</h2>
          <p className="text-xs text-gray-400">Starting balance carries over from the month before</p>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
          {barFields.map((f) => (
            <span key={f} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[f as string] }} />
              {LABELS[f as string]}
            </span>
          ))}
        </div>
      </div>

      {/* Desktop ledger */}
      <div className="hidden overflow-hidden rounded-3xl bg-white ring-1 ring-gray-100 dark:bg-gray-900 dark:ring-gray-800 md:block">
        <div className={`grid items-center gap-x-2 border-b border-gray-100 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:border-gray-800 ${desktopCols}`}>
          <span>Month</span>
          {editableFields.map((f) => (
            <span key={f} className="text-center">{LABELS[f as string]}</span>
          ))}
          <span className="text-right">Ending</span>
          <span className="pl-3">Notes</span>
        </div>
        <ul className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {rows.map((row) => {
            const isFuture = monthKey(row.start_date) > currentKey;
            const isNow = row.start_date === monthNow;
            return (
              <li
                key={row.start_date}
                className={`relative grid items-center gap-x-2 px-5 py-2.5 transition hover:bg-gray-50/70 dark:hover:bg-gray-800/30 ${desktopCols} ${
                  isNow ? "bg-[#8fae73]/[0.08]" : ""
                }`}
              >
                {isNow && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#8fae73]" />}
                <div className={isFuture ? "opacity-50" : ""}>
                  <p className="flex items-center gap-1.5 text-sm font-bold">
                    {mo(row.start_date)}
                    {isFuture && <span className="rounded bg-gray-100 px-1 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-800">plan</span>}
                  </p>
                  <div className="mt-1 w-24">{composition(row)}</div>
                </div>
                {editableFields.map((field) => {
                  // Starting balance is derived (= previous month's ending) for
                  // every month except the earliest seed row.
                  const startingDerived = field === "starting_balance" && row.start_date !== seedDate;
                  return (
                    <div key={field} className={`text-center ${isFuture ? "opacity-50 focus-within:opacity-100" : ""}`}>
                      {startingDerived ? (
                        <span
                          className="inline-block w-full px-2 py-1 text-center text-sm tabular-nums text-gray-400 dark:text-gray-500"
                          title="Derived from the previous month's ending balance"
                        >
                          {gbp0((row[field] as number) ?? 0)}
                        </span>
                      ) : (
                        <MoneyInput
                          value={(row[field] as number) ?? 0}
                          onCommit={(n) => commitNumber(row, field, n)}
                          color={COLORS[field as string]}
                          className="!w-full"
                        />
                      )}
                    </div>
                  );
                })}
                <div className={`text-right ${isFuture ? "opacity-50" : ""}`}>
                  <p className="text-sm font-extrabold tabular-nums">{gbp0(row.ending_balance)}</p>
                  {change(row)}
                </div>
                <input
                  defaultValue={row.adjustment_notes}
                  placeholder="Add a note…"
                  onBlur={(e) => commitNotes(row, e.target.value)}
                  onKeyDown={commitOnEnter(row.adjustment_notes)}
                  title={row.adjustment_notes || undefined}
                  className="ml-3 w-[calc(100%-0.75rem)] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-gray-600 placeholder-gray-300 focus:border-gray-200 focus:outline-none dark:text-gray-300 dark:placeholder-gray-600 dark:focus:border-gray-700"
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Phone: one card per month */}
      <ul className="space-y-2 md:hidden">
        {rows.map((row) => {
          const isFuture = monthKey(row.start_date) > currentKey;
          const isNow = row.start_date === monthNow;
          const startingDerived = row.start_date !== seedDate;
          const renderField = (field: keyof SavingsRow) => (
            <div key={field} className="flex items-center justify-between gap-1">
              <span className="flex shrink-0 items-center gap-1.5 text-gray-500 dark:text-gray-400">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COLORS[field as string] }} />
                {LABELS[field as string] ?? field}
              </span>
              <MoneyInput
                value={(row[field] as number) ?? 0}
                onCommit={(n) => commitNumber(row, field, n)}
                color={COLORS[field as string]}
                className="!w-16 !px-1 !text-right"
              />
            </div>
          );
          return (
            <li
              key={row.start_date}
              className={`rounded-2xl bg-white p-3 ring-1 dark:bg-gray-900 ${
                isNow ? "ring-[#8fae73]/60" : "ring-gray-100 dark:ring-gray-800"
              } ${isFuture ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 font-bold">
                    {mo(row.start_date)}
                    {isNow && <span className="rounded-full bg-[#8fae73]/15 px-1.5 text-[9px] font-bold uppercase text-[#5d7a45] dark:text-[#a9c48f]">now</span>}
                    {isFuture && <span className="rounded bg-gray-100 px-1 text-[9px] font-bold uppercase text-gray-500 dark:bg-gray-800">plan</span>}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                    from
                    {startingDerived ? (
                      <span className="tabular-nums" title="Derived from the previous month's ending balance">{gbp0(row.starting_balance ?? 0)}</span>
                    ) : (
                      <MoneyInput
                        value={row.starting_balance ?? 0}
                        onCommit={(n) => commitNumber(row, "starting_balance", n)}
                        className="!w-16 !px-1 !text-left"
                      />
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold tabular-nums">{gbp0(row.ending_balance)}</p>
                  {change(row)}
                </div>
              </div>
              <div className="mt-2">{composition(row)}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {renderField("savings")}
                {renderField("home_contributions")}
                {renderField("adjustments")}
                {showInvestments && renderField("investments")}
              </div>
              <input
                defaultValue={row.adjustment_notes}
                placeholder="Add a note…"
                onBlur={(e) => commitNotes(row, e.target.value)}
                onKeyDown={commitOnEnter(row.adjustment_notes)}
                className="mt-2 w-full rounded-lg bg-gray-50 px-2 py-1.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8fae73]/60 dark:bg-gray-800/60 dark:placeholder-gray-500"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
