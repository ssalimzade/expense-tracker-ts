import { useState } from "react";
import type { ProjectionView, ProjectionInput, AllocationField } from "../../types/projections";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";
import Tooltip from "../Tooltip";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "long" });

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

interface Props {
  rows: ProjectionView[];
  onProjectionField: (month: string, field: ProjectionInput, value: number) => void;
  onNotes: (month: string, value: string) => void;
  onAllocation: (month: string, field: AllocationField, value: number) => void;
}

const CURRENT_TINT = "bg-violet-50/70 dark:bg-violet-500/[0.07]";

function monthCellClass(month: string) {
  const isFuture = month > currentMonth;
  const isCurrent = month === currentMonth;
  return [
    "px-3 py-2 text-center",
    isFuture ? "opacity-50" : "",
    isCurrent ? CURRENT_TINT : "",
  ].join(" ");
}

// The label column stays put while the months scroll sideways.
const STICKY = "sticky left-0 z-10 bg-white dark:bg-gray-900";

/** A small heading row that opens each block of the plan. */
function Group({ label, span, children }: { label: string; span: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="border-t border-gray-100 dark:border-gray-800">
        <td className={`${STICKY} px-6 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400`}>{label}</td>
        <td colSpan={span} />
      </tr>
      {children}
    </>
  );
}

interface Line {
  label: string;
  value: (row: ProjectionView) => number;
  commit: (month: string, n: number) => void;
}

export default function ProjectionsTable({ rows, onProjectionField, onNotes, onAllocation }: Props) {
  // Phones open at this month; the months already behind you are one tap away.
  const [showEarlier, setShowEarlier] = useState(false);
  const hasCurrent = rows.some((r) => r.month === currentMonth);
  const phoneRows = showEarlier || !hasCurrent ? rows : rows.filter((r) => r.month >= currentMonth);
  const hiddenEarlier = rows.length - phoneRows.length;

  const field = (label: string, key: ProjectionInput, pick: (r: ProjectionView) => number): Line => ({
    label,
    value: pick,
    commit: (m, n) => onProjectionField(m, key, n),
  });
  const alloc = (label: string, key: AllocationField): Line => ({
    label,
    value: (r) => r[key],
    commit: (m, n) => onAllocation(m, key, n),
  });
  const groups: { label: string; lines: Line[] }[] = [
    {
      label: "Income",
      lines: [
        field("Salary", "salary", (r) => r.salary),
        field("Bonus", "bonus", (r) => r.bonus),
        field("Other P/L", "other_pl", (r) => r.other_pl),
      ],
    },
    {
      label: "Costs",
      lines: [
        field("Monthly", "monthly_costs", (r) => r.monthly_costs),
        field("Rent", "housing_costs", (r) => r.rent),
      ],
    },
    {
      label: "Put aside",
      lines: [
        alloc("Home", "home_contributions"),
        alloc("Savings", "savings"),
        alloc("Investments", "investments"),
      ],
    },
  ];

  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
          Monthly Plan
        </h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className={`${STICKY} px-6 py-3`} />
              {rows.map((row) => (
                <th
                  key={row.month}
                  className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white ${
                    row.month === currentMonth ? CURRENT_TINT : ""
                  }`}
                >
                  {mo(row.month)}
                  {row.month === currentMonth && (
                    <span className="mt-0.5 block text-[9px] font-bold tracking-[0.14em] text-violet-500 dark:text-violet-300">Now</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Group key={g.label} label={g.label} span={rows.length}>
                {g.lines.map((line) => (
                  <tr key={line.label} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className={`${STICKY} whitespace-nowrap px-6 py-2 text-sm font-medium text-gray-700 group-hover:bg-gray-50 dark:text-gray-300 dark:group-hover:bg-gray-800`}>
                      {line.label}
                    </td>
                    {rows.map((row) => (
                      <td key={row.month} className={monthCellClass(row.month)}>
                        <MoneyInput value={line.value(row)} onCommit={(n) => line.commit(row.month, n)} allowNegative />
                      </td>
                    ))}
                  </tr>
                ))}
              </Group>
            ))}

            <tr className="border-t-2 border-gray-200 dark:border-gray-700">
              <td className={`${STICKY} whitespace-nowrap px-6 py-3 text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white`}>
                Buffer
              </td>
              {rows.map((row) => (
                <td
                  key={row.month}
                  className={`${monthCellClass(row.month)} !py-3 font-bold tabular-nums whitespace-nowrap ${
                    row.buffer < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {gbp0(row.buffer)}
                </td>
              ))}
            </tr>

            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className={`${STICKY} whitespace-nowrap px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400`}>
                Notes
              </td>
              {rows.map((row) => (
                <td key={row.month} className={monthCellClass(row.month)}>
                  <Tooltip label={row.notes} className="block">
                    <input
                      defaultValue={row.notes}
                      key={row.notes}
                      placeholder="Notes…"
                      onBlur={(e) => e.target.value !== row.notes && onNotes(row.month, e.target.value)}
                      onKeyDown={commitOnEnter(row.notes)}
                      className="w-full min-w-[60px] max-w-[100px] truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-200 focus:outline-none dark:placeholder-gray-600 dark:focus:border-gray-700"
                    />
                  </Tooltip>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile cards — one per month */}
      {hiddenEarlier > 0 && (
        <button
          type="button"
          onClick={() => setShowEarlier(true)}
          className="flex w-full items-center justify-center gap-1.5 border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800/40 md:hidden"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5">
            <path fillRule="evenodd" d="M11.78 9.78a.75.75 0 0 1-1.06 0L8 7.06 5.28 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06Z" clipRule="evenodd" />
          </svg>
          Show {hiddenEarlier} earlier month{hiddenEarlier === 1 ? "" : "s"}
        </button>
      )}
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {phoneRows.map((row) => {
          const field = (label: string, value: number, onCommit: (n: number) => void, color?: string) => (
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-400">{label}</span>
              <MoneyInput value={value} onCommit={onCommit} color={color} allowNegative className="!w-16 !px-1 !text-right" />
            </div>
          );
          return (
            <li
              key={row.month}
              className={`px-4 py-2.5 ${row.month > currentMonth ? "opacity-60" : ""} ${row.month === currentMonth ? "bg-violet-50/70 dark:bg-violet-500/[0.07]" : ""}`}
            >
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{mo(row.month)}</div>
              <div className="mt-2 grid grid-cols-2 gap-x-5 gap-y-1 text-xs">
                <div className="space-y-1">
                  {field("Salary", row.salary, (n) => onProjectionField(row.month, "salary", n))}
                  {field("Bonus", row.bonus, (n) => onProjectionField(row.month, "bonus", n))}
                  {field("Monthly costs", row.monthly_costs, (n) => onProjectionField(row.month, "monthly_costs", n))}
                  {field("Rent", row.rent, (n) => onProjectionField(row.month, "housing_costs", n))}
                </div>
                <div className="space-y-1">
                  {field("Home", row.home_contributions, (n) => onAllocation(row.month, "home_contributions", n))}
                  {field("Savings", row.savings, (n) => onAllocation(row.month, "savings", n))}
                  {field("Investments", row.investments, (n) => onAllocation(row.month, "investments", n))}
                  {field("Other P/L", row.other_pl, (n) => onProjectionField(row.month, "other_pl", n))}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 dark:border-gray-800">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Buffer</span>
                <span className={`pr-1 text-base font-bold tabular-nums ${row.buffer < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {gbp0(row.buffer)}
                </span>
              </div>
              <input
                defaultValue={row.notes}
                key={row.notes}
                placeholder="Notes…"
                onBlur={(e) => e.target.value !== row.notes && onNotes(row.month, e.target.value)}
                onKeyDown={commitOnEnter(row.notes)}
                className="mt-2 w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm placeholder-gray-300 focus:border-gray-300 focus:outline-none dark:border-gray-700 dark:placeholder-gray-600"
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
