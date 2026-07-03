import type { ProjectionView, ProjectionInput, AllocationField } from "../../types/projections";
import { gbp0 } from "../../lib/format";
import { commitOnEnter } from "../../lib/keys";
import { Card } from "../common";
import MoneyInput from "../MoneyInput";
import Tooltip from "../Tooltip";

const mo = (m: string) => new Date(`${m}-01`).toLocaleString("en-GB", { month: "short" });

const currentMonth = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
})();

const PROJ_COLS: { field: "salary" | "bonus" | "monthly_costs"; label: string; color?: string }[] = [
  { field: "salary", label: "Salary", color: "#6366f1" },
  { field: "bonus", label: "Bonus" },
  { field: "monthly_costs", label: "Monthly", color: "#f97316" },
];

const ALLOC_COLS: { field: AllocationField; label: string; color: string }[] = [
  { field: "home_contributions", label: "Home", color: "#0ea5e9" },
  { field: "savings", label: "Savings", color: "#10b981" },
  { field: "investments", label: "Invest", color: "#a855f7" },
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
                <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: c.color }}>
                  <span className={c.color ? "" : "text-gray-600 dark:text-white"}>{c.label}</span>
                </td>
                {rows.map((row) => (
                  <td key={row.month} className={monthCellClass(row.month)}>
                    <MoneyInput
                      value={row[c.field]}
                      onCommit={(n) => onProjectionField(row.month, c.field, n)}
                      color={c.color}
                    />
                  </td>
                ))}
              </tr>
            ))}

            <tr className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
              <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 whitespace-nowrap">
                Rent
              </td>
              {rows.map((row) => (
                <td key={row.month} className={monthCellClass(row.month)}>
                  <MoneyInput
                    value={row.rent}
                    onCommit={(n) => onProjectionField(row.month, "housing_costs", n)}
                    color="#ea580c"
                  />
                </td>
              ))}
            </tr>

            {ALLOC_COLS.map((c) => (
              <tr key={c.field} className="group hover:bg-gray-50 dark:hover:bg-gray-800/40">
                <td className="px-6 py-2.5 text-xs font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: c.color }}>
                  {c.label}
                </td>
                {rows.map((row) => (
                  <td key={row.month} className={monthCellClass(row.month)}>
                    <MoneyInput
                      value={row[c.field]}
                      onCommit={(n) => onAllocation(row.month, c.field, n)}
                      color={c.color}
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
        {rows.map((row) => (
          <li
            key={row.month}
            className={`px-4 py-3 ${row.month > currentMonth ? "opacity-60" : ""} ${row.month === currentMonth ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700 dark:text-gray-300">{mo(row.month)}</span>
              <span className="text-xs text-gray-400">
                Buffer{" "}
                <span className={`text-sm font-bold tabular-nums ${row.buffer < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {gbp0(row.buffer)}
                </span>
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Salary</span><MoneyInput value={row.salary} onCommit={(n) => onProjectionField(row.month, "salary", n)} color="#6366f1" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Bonus</span><MoneyInput value={row.bonus} onCommit={(n) => onProjectionField(row.month, "bonus", n)} /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Monthly</span><MoneyInput value={row.monthly_costs} onCommit={(n) => onProjectionField(row.month, "monthly_costs", n)} color="#f97316" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Rent</span><MoneyInput value={row.rent} onCommit={(n) => onProjectionField(row.month, "housing_costs", n)} color="#ea580c" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Home</span><MoneyInput value={row.home_contributions} onCommit={(n) => onAllocation(row.month, "home_contributions", n)} color="#0ea5e9" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Savings</span><MoneyInput value={row.savings} onCommit={(n) => onAllocation(row.month, "savings", n)} color="#10b981" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Invest</span><MoneyInput value={row.investments} onCommit={(n) => onAllocation(row.month, "investments", n)} color="#a855f7" /></div>
              <div className="flex items-center justify-between gap-1"><span className="text-gray-400">Other P/L</span><MoneyInput value={row.other_pl} onCommit={(n) => onProjectionField(row.month, "other_pl", n)} allowNegative /></div>
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
        ))}
      </ul>
    </Card>
  );
}
