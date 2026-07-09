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

// Category rows are all neutral grey — only the Buffer row is coloured, to keep
// the table from feeling too busy.
const PROJ_COLS: { field: "salary" | "bonus" | "monthly_costs"; label: string }[] = [
  { field: "salary", label: "Salary" },
  { field: "bonus", label: "Bonus" },
  { field: "monthly_costs", label: "Monthly" },
];

const ALLOC_COLS: { field: AllocationField; label: string }[] = [
  { field: "home_contributions", label: "Home" },
  { field: "savings", label: "Savings" },
  { field: "investments", label: "Invest" },
];

interface Props {
  rows: ProjectionView[];
  onProjectionField: (month: string, field: ProjectionInput, value: number) => void;
  onNotes: (month: string, value: string) => void;
  onAllocation: (month: string, field: AllocationField, value: number) => void;
}

function monthCellClass(month: string) {
  const isFuture = month > currentMonth;
  const isCurrent = month === currentMonth;
  return [
    "px-3 py-2.5 text-center",
    isFuture ? "opacity-50" : "",
    isCurrent ? "bg-indigo-50/40 dark:bg-indigo-950/20" : "",
  ].join(" ");
}

export default function ProjectionsTable({ rows, onProjectionField, onNotes, onAllocation }: Props) {
  return (
    <Card className="p-0 overflow-hidden max-md:!p-0">
      <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800 sm:px-6 sm:py-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Monthly Plan
        </h2>
      </div>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white" />
              {rows.map((row) => (
                <th
                  key={row.month}
                  className={`px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white ${
                    row.month === currentMonth ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""
                  }`}
                >
                  {mo(row.month)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {PROJ_COLS.map((c) => (
              <tr key={c.field} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                  {c.label}
                </td>
                {rows.map((row) => (
                  <td key={row.month} className={monthCellClass(row.month)}>
                    <MoneyInput
                      value={row[c.field]}
                      onCommit={(n) => onProjectionField(row.month, c.field, n)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                Rent
              </td>
              {rows.map((row) => (
                <td key={row.month} className={monthCellClass(row.month)}>
                  <MoneyInput
                    value={row.rent}
                    onCommit={(n) => onProjectionField(row.month, "housing_costs", n)}
                  />
                </td>
              ))}
            </tr>

            {ALLOC_COLS.map((c) => (
              <tr key={c.field} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                  {c.label}
                </td>
                {rows.map((row) => (
                  <td key={row.month} className={monthCellClass(row.month)}>
                    <MoneyInput
                      value={row[c.field]}
                      onCommit={(n) => onAllocation(row.month, c.field, n)}
                    />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap">
                Other P/L
              </td>
              {rows.map((row) => (
                <td key={row.month} className={monthCellClass(row.month)}>
                  <MoneyInput
                    value={row.other_pl}
                    onCommit={(n) => onProjectionField(row.month, "other_pl", n)}
                    allowNegative
                  />
                </td>
              ))}
            </tr>

            <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap border-t-2 border-gray-300 dark:border-gray-600">
                Buffer
              </td>
              {rows.map((row) => (
                <td
                  key={row.month}
                  className={`${monthCellClass(row.month)} border-t-2 border-gray-300 dark:border-gray-600 font-bold tabular-nums whitespace-nowrap ${
                    row.buffer < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {gbp0(row.buffer)}
                </td>
              ))}
            </tr>

            <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-white whitespace-nowrap border-t-2 border-gray-300 dark:border-gray-600">
                Notes
              </td>
              {rows.map((row) => (
                <td key={row.month} className={`${monthCellClass(row.month)} border-t-2 border-gray-300 dark:border-gray-600`}>
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
      <ul className="divide-y divide-gray-50 dark:divide-gray-800/60 md:hidden">
        {rows.map((row) => {
          const field = (label: string, value: number, onCommit: (n: number) => void, color?: string, allowNegative?: boolean) => (
            <div className="flex items-center justify-between gap-2">
              <span className="text-gray-400">{label}</span>
              <MoneyInput value={value} onCommit={onCommit} color={color} allowNegative={allowNegative} className="!w-16 !px-1 !text-right" />
            </div>
          );
          return (
            <li
              key={row.month}
              className={`px-4 py-2.5 ${row.month > currentMonth ? "opacity-60" : ""} ${row.month === currentMonth ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}
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
                  {field("Other P/L", row.other_pl, (n) => onProjectionField(row.month, "other_pl", n), undefined, true)}
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
